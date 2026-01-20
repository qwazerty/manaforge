#!/usr/bin/env python3
"""Download Scryfall + Cardmarket datasets in memory and import into PostgreSQL.

Features
- Lit les credentials depuis .env / variables d'environnement.
- Télécharge en mémoire (pas d'écriture disque), importe en staging, indexe puis swap atomique.
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
from psycopg import sql
from psycopg.types.json import Jsonb

# Import normalize_name from shared utility module
# Add parent directory to path so we can import from app
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.backend.utils.text import normalize_name as _normalize_name


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
def _fetch_json(url: str) -> Any:
    try:
        with urlopen(url) as resp:  # type: ignore[arg-type]
            return json.load(resp)
    except URLError as exc:
        raise SystemExit(f"Unable to fetch {url}: {exc}")


def fetch_scryfall_dump() -> List[Dict[str, Any]]:
    """Download Scryfall bulk data into memory (no file writes)."""

    metadata = _fetch_json(SCRYFALL_BULK_METADATA)
    download_uri = metadata.get("download_uri")
    print(f"Scryfall download URI: {download_uri}")
    if not download_uri:
        raise SystemExit("Scryfall metadata missing download_uri")

    print("Downloading Scryfall dump into memory…")
    payload = _fetch_json(download_uri)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        data = payload.get("data") or payload.get("cards")
        if isinstance(data, list):
            return data
    raise SystemExit("Unexpected Scryfall payload structure")


def fetch_cardmarket_payloads() -> Dict[str, List[Dict[str, Any]]]:
    """Download Cardmarket products and prices into memory."""

    print("Downloading Cardmarket products into memory…")
    products_payload = _fetch_json(CARDMARKET_PRODUCTS_URL)
    print("Downloading Cardmarket price guide into memory…")
    price_payload = _fetch_json(CARDMARKET_PRICE_URL)

    products_list = []
    if isinstance(products_payload, dict):
        products_list = products_payload.get("products") or []
    elif isinstance(products_payload, list):
        products_list = products_payload

    price_list = []
    if isinstance(price_payload, dict):
        price_list = price_payload.get("priceGuides") or []
    elif isinstance(price_payload, list):
        price_list = price_payload

    return {"products": products_list, "prices": price_list}


# ---------------------------
# Data loading
# ---------------------------


def _table_exists(cur: psycopg.Cursor, name: str) -> bool:
    cur.execute("SELECT to_regclass(%s)", (name,))
    return cur.fetchone()[0] is not None


def prepare_staging_schema(conn: psycopg.Connection) -> None:
    """Create fresh staging tables (cards_new, cardmarket_price_new) without indexes.
    
    Indexes are created after data import for better performance.
    """

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
    ]
    with conn.cursor() as cur:
        for stmt in stmts:
            cur.execute(stmt)
    conn.commit()


def create_indexes_on_staging(conn: psycopg.Connection) -> None:
    """Create indexes on staging tables after data import for better performance."""

    stmts = [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_normalized_name ON cards_new (normalized_name);",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_normalized_name_trgm ON cards_new USING gin (normalized_name gin_trgm_ops);",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_oracle_id ON cards_new (oracle_id);",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_set ON cards_new (set);",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_rarity ON cards_new (rarity);",
        "CREATE INDEX IF NOT EXISTS idx_cards_new_cmc ON cards_new (cmc);",
        "CREATE INDEX IF NOT EXISTS idx_cmp_new_normalized_name ON cardmarket_price_new (normalized_name);",
        "CREATE INDEX IF NOT EXISTS idx_cmp_new_price ON cardmarket_price_new (price);",
        "CREATE INDEX IF NOT EXISTS idx_cmp_new_expansion ON cardmarket_price_new (id_expansion);",
    ]
    with conn.cursor() as cur:
        for stmt in stmts:
            cur.execute(stmt)
    conn.commit()


def swap_tables(conn: psycopg.Connection, base: str, staging: str) -> None:
    """Atomically swap staging into place, dropping the previous base if present."""

    base_id = sql.Identifier(base)
    base_old_id = sql.Identifier(f"{base}_old")
    staging_id = sql.Identifier(staging)

    with conn.cursor() as cur:
        exists = _table_exists(cur, base)
        # drop lingering old table to avoid rename collision
        cur.execute(sql.SQL("DROP TABLE IF EXISTS {}").format(base_old_id))

        # rename current base to _old if it exists
        if exists:
            cur.execute(sql.SQL("ALTER TABLE {} RENAME TO {}").format(base_id, sql.Identifier(f"{base}_old")))

        # move staging into place
        cur.execute(sql.SQL("ALTER TABLE {} RENAME TO {}").format(staging_id, base_id))

        # drop old version if it was present
        cur.execute(sql.SQL("DROP TABLE IF EXISTS {}").format(base_old_id))

        # analyze the new table for query planner optimization
        cur.execute(sql.SQL("ANALYZE {}").format(base_id))
    conn.commit()


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
    query = sql.SQL("""
        INSERT INTO {} (
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
    """).format(sql.Identifier(table))

    inserted = 0
    buffer: List[Tuple[Any, ...]] = []

    with conn.cursor() as cur:
        for row in rows:
            buffer.append(row)
            if len(buffer) >= batch_size:
                cur.executemany(query, buffer)
                inserted += len(buffer)
                buffer.clear()

        if buffer:
            cur.executemany(query, buffer)
            inserted += len(buffer)

    conn.commit()
    return inserted


def upsert_cards(
    conn: psycopg.Connection,
    table: str,
    rows: Iterable[Tuple[str, Dict[str, Any], Dict[str, Any]]],
    batch_size: int,
) -> int:
    query = sql.SQL("""
        INSERT INTO {} (
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
    """).format(sql.Identifier(table))

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
                cur.executemany(query, buffer)
                inserted += len(buffer)
                buffer.clear()

        if buffer:
            cur.executemany(query, buffer)
            inserted += len(buffer)

    conn.commit()
    return inserted


def import_into_postgres(
    conn: psycopg.Connection,
    scryfall_cards: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    price_guides: List[Dict[str, Any]],
    batch_size: int,
) -> None:
    prepare_staging_schema(conn)

    print("Importing Scryfall cards into Postgres…")
    card_rows = (extract_card_row(doc) for doc in scryfall_cards)
    cards_inserted = upsert_cards(conn, "cards_new", card_rows, batch_size)
    print(f"  cards upserted (staging): {cards_inserted}")

    if products and price_guides:
        print("Importing Cardmarket price table…")
        rows = build_cardmarket_rows(products, price_guides)
        prices_inserted = upsert_cardmarket_prices(conn, "cardmarket_price_new", rows, batch_size)
        print(f"  cardmarket rows upserted (staging): {prices_inserted}")
    else:
        print("  skipped Cardmarket (missing payload)")

    print("Creating indexes on staging tables…")
    create_indexes_on_staging(conn)
    print("  indexes created.")

    print("Swapping staging tables atomically…")
    swap_tables(conn, "cards", "cards_new")
    swap_tables(conn, "cardmarket_price", "cardmarket_price_new")
    print("Swap complete.")


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
        "--batch-size",
        type=int,
        default=int(os.getenv("BATCH_SIZE", "750")),
        help="Number of documents per batch insert",
    )
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Only download payloads, do not import into Postgres",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv or sys.argv[1:])

    repo_root = Path(__file__).resolve().parents[1]

    env_path = Path(args.env_file) if args.env_file else repo_root / ".env"
    load_dotenv(env_path)

    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    # 1) Scryfall download
    scryfall_cards = fetch_scryfall_dump()

    if args.download_only:
        # Optionally also download Cardmarket then exit
        fetch_cardmarket_payloads()
        print("Download completed; skipping Postgres import (download-only requested).")
        return

    # 2) Cardmarket download
    cm_payloads = fetch_cardmarket_payloads()

    # 3) Import
    pg_dsn = build_pg_dsn()
    with psycopg.connect(pg_dsn) as conn:
        import_into_postgres(
            conn,
            scryfall_cards=scryfall_cards,
            products=cm_payloads["products"],
            price_guides=cm_payloads["prices"],
            batch_size=args.batch_size,
        )


if __name__ == "__main__":
    main()
