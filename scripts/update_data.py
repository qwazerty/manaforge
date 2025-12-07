#!/usr/bin/env python3
"""Download card datasets and import them into PostgreSQL.

Features
- Reads connection settings from a .env file (defaults to repo root) and env vars.
- Downloads Scryfall bulk data + Cardmarket catalog/price files into ./data.
- Creates minimal tables and upserts JSONB payloads.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import URLError
from urllib.request import urlopen

import psycopg
from psycopg.types.json import Jsonb


SCRYFALL_BULK_METADATA = "https://api.scryfall.com/bulk-data/unique_artwork"
CARDMARKET_PRODUCTS_URL = (
    "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_1.json"
)
CARDMARKET_PRICE_URL = (
    "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json"
)


# ---------------------------
# Env helpers
# ---------------------------
def load_dotenv(env_path: Path) -> None:
    """Load KEY=VALUE lines from a .env file into os.environ if not already set."""

    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def build_pg_dsn() -> str:
    """Build a PostgreSQL DSN from env vars, with compose-friendly defaults."""

    user = os.getenv("POSTGRES_USER", "manaforge")
    password = os.getenv("POSTGRES_PASSWORD", "manaforge")
    db = os.getenv("POSTGRES_DB", "manaforge")
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")

    url_database = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    print(f"Connecting to Postgres with DSN: postgresql://{user}@{host}:{port}/{db}")
    return(url_database)


# ---------------------------
# Download helpers
# ---------------------------
def download_file(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url) as resp, dest.open("wb") as fh:  # type: ignore[arg-type]
        fh.write(resp.read())
    return dest


def fetch_scryfall_dump(data_dir: Path, skip_download: bool) -> Path:
    target = data_dir / "oracle-cards.json"
    if skip_download and target.exists():
        return target

    try:
        with urlopen(SCRYFALL_BULK_METADATA) as resp:  # type: ignore[arg-type]
            metadata = json.load(resp)
    except URLError as exc:
        raise SystemExit(f"Unable to fetch Scryfall metadata: {exc}")

    download_uri = metadata.get("download_uri")
    if not download_uri:
        raise SystemExit("Scryfall metadata missing download_uri")

    print(f"Downloading Scryfall dump -> {target}")
    return download_file(download_uri, target)


def fetch_cardmarket_files(data_dir: Path, skip_download: bool) -> Dict[str, Path]:
    products_path = data_dir / "products_singles_1.json"
    price_path = data_dir / "price_guide_1.json"

    if not skip_download:
        print(f"Downloading Cardmarket products -> {products_path}")
        download_file(CARDMARKET_PRODUCTS_URL, products_path)
        print(f"Downloading Cardmarket price guide -> {price_path}")
        download_file(CARDMARKET_PRICE_URL, price_path)

    return {"products": products_path, "prices": price_path}


# ---------------------------
# Data loading
# ---------------------------
def load_json_array(path: Path) -> List[Dict[str, Any]]:
    """Return the list contained in common payload shapes.

    Supports:
    - a top-level list
    - dict with keys: data, cards, products, priceGuides
    """

    with path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)

    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "cards", "products", "priceGuides"):
            if key in payload and isinstance(payload[key], list):
                return payload[key]
    raise ValueError(f"Unexpected JSON structure in {path}")


def prepare_documents(raw_docs: List[Dict[str, Any]], key_field: str) -> Iterable[Tuple[str, Dict[str, Any]]]:
    for doc in raw_docs:
        if not isinstance(doc, dict):
            continue
        key = doc.get(key_field)
        if key is None:
            continue
        yield str(key), doc


def _table_exists(cur: psycopg.Cursor, name: str) -> bool:
    cur.execute("SELECT to_regclass(%s)", (name,))
    return cur.fetchone()[0] is not None


def prepare_staging_schema(conn: psycopg.Connection) -> None:
    """Create fresh staging tables (cards_new, cardmarket_price_new) with indexes."""

    stmts = [
        "DROP TABLE IF EXISTS cardmarket_price_new;",
        "DROP TABLE IF EXISTS cards_new;",
        """
        CREATE TABLE cards_new (
            id text PRIMARY KEY,
            data jsonb NOT NULL,
            name text,
            normalized_name text,
            set text,
            set_name text,
            rarity text,
            cmc numeric,
            mana_cost text,
            type_line text,
            oracle_text text,
            colors text[],
            power text,
            toughness text,
            loyalty text,
            scryfall_id text,
            oracle_id text,
            released_at date,
            image_url text
        );
        """,
        """
        CREATE TABLE cardmarket_price_new (
            id bigint PRIMARY KEY,
            name text,
            normalized_name text,
            alt_names text[],
            id_category integer,
            id_expansion integer,
            id_metacard integer,
            date_added date,
            price numeric,
            price_avg numeric,
            price_low numeric,
            price_trend numeric,
            price_avg1 numeric,
            price_avg7 numeric,
            price_avg30 numeric,
            price_avg_foil numeric,
            price_low_foil numeric,
            price_trend_foil numeric,
            price_avg1_foil numeric,
            price_avg7_foil numeric,
            price_avg30_foil numeric,
            data jsonb,
            product jsonb
        );
        """,
        "CREATE INDEX idx_cards_new_normalized_name ON cards_new (normalized_name);",
        "CREATE INDEX idx_cards_new_set ON cards_new (set);",
        "CREATE INDEX idx_cards_new_rarity ON cards_new (rarity);",
        "CREATE INDEX idx_cards_new_cmc ON cards_new (cmc);",
        "CREATE INDEX idx_cmp_new_normalized_name ON cardmarket_price_new (normalized_name);",
        "CREATE INDEX idx_cmp_new_price ON cardmarket_price_new (price);",
        "CREATE INDEX idx_cmp_new_expansion ON cardmarket_price_new (id_expansion);",
    ]
    with conn.cursor() as cur:
        for stmt in stmts:
            cur.execute(stmt)
    conn.commit()


def swap_tables(conn: psycopg.Connection, base: str, staging: str) -> None:
    """Atomically swap staging into place, dropping the previous base if present."""

    with conn.cursor() as cur:
        exists = _table_exists(cur, base)
        # drop lingering old table to avoid rename collision
        cur.execute(f"DROP TABLE IF EXISTS {base}_old;")

        # rename current base to _old if it exists
        if exists:
            cur.execute(f"ALTER TABLE {base} RENAME TO {base}_old;")

        # move staging into place
        cur.execute(f"ALTER TABLE {staging} RENAME TO {base};")

        # drop old version if it was present
        cur.execute(f"DROP TABLE IF EXISTS {base}_old;")
    conn.commit()


def upsert_jsonb(
    conn: psycopg.Connection,
    table: str,
    rows: Iterable[Tuple[str, Dict[str, Any]]],
    batch_size: int,
) -> int:
    inserted = 0
    buffer: List[Tuple[str, Dict[str, Any]]] = []

    sql = f"""
        INSERT INTO {table} (id, data)
        VALUES (%s, %s)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    """

    with conn.cursor() as cur:
        for row in rows:
            # psycopg needs explicit JSON adaptation when using %s placeholders
            row_id, payload = row
            buffer.append((row_id, Jsonb(payload)))
            if len(buffer) >= batch_size:
                cur.executemany(sql, buffer)
                inserted += len(buffer)
                buffer.clear()

        if buffer:
            cur.executemany(sql, buffer)
            inserted += len(buffer)

    conn.commit()
    return inserted


def _normalize_name(name: str) -> str:
    import unicodedata
    import re

    if not isinstance(name, str):
        return ""
    normalized = unicodedata.normalize("NFKD", name)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.lower().strip().replace("’", "'").replace("`", "'").replace("´", "'")
    normalized = re.sub(r"[–—-]", " ", normalized)
    normalized = re.sub(r"[,:/]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def extract_card_row(card: Dict[str, Any]) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
    """Return (id, json_payload, typed_fields)."""

    card_id = str(card.get("id"))
    if not card_id:
        raise ValueError("Card missing id")

    front_face = None
    faces = card.get("card_faces") or []
    if isinstance(faces, list) and faces:
        front_face = faces[0]

    def first_non_empty(key: str, default=None):
        if front_face and front_face.get(key) not in (None, ""):
            return front_face.get(key)
        return card.get(key, default)

    image_url = None
    if isinstance(card.get("image_uris"), dict):
        image_url = card["image_uris"].get("normal")
    if not image_url and isinstance(faces, list):
        for face in faces:
            if isinstance(face.get("image_uris"), dict):
                url = face["image_uris"].get("normal")
                if url:
                    image_url = url
                    break

    colors = card.get("colors")
    if isinstance(colors, list):
        colors_clean = [str(c) for c in colors]
    else:
        colors_clean = None

    typed = {
        "name": card.get("name"),
        "normalized_name": _normalize_name(card.get("name") or ""),
        "set": card.get("set"),
        "set_name": card.get("set_name"),
        "rarity": card.get("rarity"),
        "cmc": card.get("cmc"),
        "mana_cost": first_non_empty("mana_cost", card.get("mana_cost")),
        "type_line": first_non_empty("type_line", card.get("type_line")),
        "oracle_text": first_non_empty("oracle_text", card.get("oracle_text")),
        "colors": colors_clean,
        "power": first_non_empty("power", card.get("power")),
        "toughness": first_non_empty("toughness", card.get("toughness")),
        "loyalty": card.get("loyalty"),
        "scryfall_id": card.get("id"),
        "oracle_id": card.get("oracle_id"),
        "released_at": card.get("released_at"),
        "image_url": image_url,
    }

    return card_id, card, typed


def _to_float(val: Any) -> Optional[float]:
    try:
        f = float(val)
        return f
    except (TypeError, ValueError):
        return None


def build_cardmarket_rows(
    products: List[Dict[str, Any]], price_guides: List[Dict[str, Any]]
) -> Iterable[Tuple[Any, ...]]:
    products_by_id = {}
    for p in products:
        pid = p.get("idProduct")
        try:
            pid_int = int(pid)
        except (TypeError, ValueError):
            continue
        products_by_id[pid_int] = p

    for pg in price_guides:
        pid = pg.get("idProduct")
        if pid is None:
            continue
        try:
            pid_int = int(pid)
        except (ValueError, TypeError):
            continue

        product = products_by_id.get(pid_int)
        name = product.get("name") if isinstance(product, dict) else None
        normalized_name = _normalize_name(name or "") if name else None

        alt_names: Optional[List[str]] = None
        if name and "//" in name:
            alt_names = [_normalize_name(part) for part in name.split("//") if part.strip()]
            if not alt_names:
                alt_names = None

        id_category = product.get("idCategory") if product else None
        id_expansion = product.get("idExpansion") if product else None
        id_metacard = product.get("idMetacard") if product else None
        date_added = product.get("dateAdded") if product else None

        price_trend = _to_float(pg.get("trend"))
        price_avg = _to_float(pg.get("avg"))
        price_low = _to_float(pg.get("low"))
        price_avg1 = _to_float(pg.get("avg1"))
        price_avg7 = _to_float(pg.get("avg7"))
        price_avg30 = _to_float(pg.get("avg30"))
        price_avg_foil = _to_float(pg.get("avg-foil"))
        price_low_foil = _to_float(pg.get("low-foil"))
        price_trend_foil = _to_float(pg.get("trend-foil"))
        price_avg1_foil = _to_float(pg.get("avg1-foil"))
        price_avg7_foil = _to_float(pg.get("avg7-foil"))
        price_avg30_foil = _to_float(pg.get("avg30-foil"))

        selected_price = None
        for candidate in (price_trend, price_avg, price_low):
            if candidate is not None and candidate > 0:
                selected_price = candidate
                break

        yield (
            pid_int,
            name,
            normalized_name,
            alt_names,
            id_category,
            id_expansion,
            id_metacard,
            date_added,
            selected_price,
            price_avg,
            price_low,
            price_trend,
            price_avg1,
            price_avg7,
            price_avg30,
            price_avg_foil,
            price_low_foil,
            price_trend_foil,
            price_avg1_foil,
            price_avg7_foil,
            price_avg30_foil,
            Jsonb(pg),
            Jsonb(product) if product else None,
        )


def upsert_cardmarket_prices(
    conn: psycopg.Connection,
    table: str,
    rows: Iterable[Tuple[Any, ...]],
    batch_size: int,
) -> int:
    sql = f"""
        INSERT INTO {table} (
            id, name, normalized_name, alt_names, id_category, id_expansion, id_metacard, date_added,
            price, price_avg, price_low, price_trend, price_avg1, price_avg7, price_avg30,
            price_avg_foil, price_low_foil, price_trend_foil, price_avg1_foil, price_avg7_foil, price_avg30_foil,
            data, product
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            normalized_name = EXCLUDED.normalized_name,
            alt_names = EXCLUDED.alt_names,
            id_category = EXCLUDED.id_category,
            id_expansion = EXCLUDED.id_expansion,
            id_metacard = EXCLUDED.id_metacard,
            date_added = EXCLUDED.date_added,
            price = EXCLUDED.price,
            price_avg = EXCLUDED.price_avg,
            price_low = EXCLUDED.price_low,
            price_trend = EXCLUDED.price_trend,
            price_avg1 = EXCLUDED.price_avg1,
            price_avg7 = EXCLUDED.price_avg7,
            price_avg30 = EXCLUDED.price_avg30,
            price_avg_foil = EXCLUDED.price_avg_foil,
            price_low_foil = EXCLUDED.price_low_foil,
            price_trend_foil = EXCLUDED.price_trend_foil,
            price_avg1_foil = EXCLUDED.price_avg1_foil,
            price_avg7_foil = EXCLUDED.price_avg7_foil,
            price_avg30_foil = EXCLUDED.price_avg30_foil,
            data = EXCLUDED.data,
            product = EXCLUDED.product
    """

    inserted = 0
    buffer: List[Tuple[Any, ...]] = []

    with conn.cursor() as cur:
        for row in rows:
            buffer.append(row)
            if len(buffer) >= batch_size:
                cur.executemany(sql, buffer)
                inserted += len(buffer)
                buffer.clear()

        if buffer:
            cur.executemany(sql, buffer)
            inserted += len(buffer)

    conn.commit()
    return inserted


def upsert_cards(
    conn: psycopg.Connection,
    table: str,
    rows: Iterable[Tuple[str, Dict[str, Any], Dict[str, Any]]],
    batch_size: int,
) -> int:
    sql = f"""
        INSERT INTO {table} (
            id, data, name, normalized_name, set, set_name, rarity, cmc,
            mana_cost, type_line, oracle_text, colors, power, toughness,
            loyalty, scryfall_id, oracle_id, released_at, image_url
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        )
        ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            name = EXCLUDED.name,
            normalized_name = EXCLUDED.normalized_name,
            set = EXCLUDED.set,
            set_name = EXCLUDED.set_name,
            rarity = EXCLUDED.rarity,
            cmc = EXCLUDED.cmc,
            mana_cost = EXCLUDED.mana_cost,
            type_line = EXCLUDED.type_line,
            oracle_text = EXCLUDED.oracle_text,
            colors = EXCLUDED.colors,
            power = EXCLUDED.power,
            toughness = EXCLUDED.toughness,
            loyalty = EXCLUDED.loyalty,
            scryfall_id = EXCLUDED.scryfall_id,
            oracle_id = EXCLUDED.oracle_id,
            released_at = EXCLUDED.released_at,
            image_url = EXCLUDED.image_url
    """

    inserted = 0
    buffer: List[Tuple[Any, ...]] = []

    with conn.cursor() as cur:
        for row_id, payload, typed in rows:
            buffer.append(
                (
                    row_id,
                    Jsonb(payload),
                    typed.get("name"),
                    typed.get("normalized_name"),
                    typed.get("set"),
                    typed.get("set_name"),
                    typed.get("rarity"),
                    typed.get("cmc"),
                    typed.get("mana_cost"),
                    typed.get("type_line"),
                    typed.get("oracle_text"),
                    typed.get("colors"),
                    typed.get("power"),
                    typed.get("toughness"),
                    typed.get("loyalty"),
                    typed.get("scryfall_id"),
                    typed.get("oracle_id"),
                    typed.get("released_at"),
                    typed.get("image_url"),
                )
            )
            if len(buffer) >= batch_size:
                cur.executemany(sql, buffer)
                inserted += len(buffer)
                buffer.clear()

        if buffer:
            cur.executemany(sql, buffer)
            inserted += len(buffer)

    conn.commit()
    return inserted


def import_into_postgres(
    conn: psycopg.Connection,
    scryfall_path: Path,
    products_path: Path,
    price_path: Path,
    batch_size: int,
) -> None:
    prepare_staging_schema(conn)

    print("Importing Scryfall cards into Postgres…")
    scryfall_docs = load_json_array(scryfall_path)
    card_rows = (extract_card_row(doc) for doc in scryfall_docs)
    cards_inserted = upsert_cards(conn, "cards_new", card_rows, batch_size)
    print(f"  cards upserted (staging): {cards_inserted}")

    if products_path.exists() and price_path.exists():
        print("Importing Cardmarket price table…")
        product_docs = load_json_array(products_path)
        price_docs = load_json_array(price_path)
        rows = build_cardmarket_rows(product_docs, price_docs)
        prices_inserted = upsert_cardmarket_prices(conn, "cardmarket_price_new", rows, batch_size)
        print(f"  cardmarket rows upserted (staging): {prices_inserted}")
    else:
        print("  skipped Cardmarket (file missing)")

    print("Swapping staging tables atomiquement…")
    swap_tables(conn, "cards", "cards_new")
    swap_tables(conn, "cardmarket_price", "cardmarket_price_new")
    print("Swap terminé.")


# ---------------------------
# CLI
# ---------------------------
def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update ManaForge datasets and import to PostgreSQL")
    parser.add_argument(
        "--env-file",
        default=None,
        help="Path to .env file (default: <repo>/.env)",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Override DATABASE_URL (otherwise built from env vars)",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Override data directory (default: <repo>/data)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("BATCH_SIZE", "750")),
        help="Number of documents per batch insert",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip downloading files and reuse existing ones in data_dir",
    )
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Only download files, do not import into Postgres",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv or sys.argv[1:])

    repo_root = Path(__file__).resolve().parents[1]

    env_path = Path(args.env_file) if args.env_file else repo_root / ".env"
    load_dotenv(env_path)

    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    data_dir = Path(args.data_dir) if args.data_dir else repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    scryfall_path = fetch_scryfall_dump(data_dir, args.skip_download)
    cardmarket_files = fetch_cardmarket_files(data_dir, args.skip_download)

    if args.download_only:
        print("Download completed; skipping Postgres import (download-only requested).")
        return

    pg_dsn = build_pg_dsn()
    with psycopg.connect(pg_dsn) as conn:
        import_into_postgres(
            conn,
            scryfall_path=scryfall_path,
            products_path=cardmarket_files["products"],
            price_path=cardmarket_files["prices"],
            batch_size=args.batch_size,
        )


if __name__ == "__main__":
    main()
