"""Utilities for computing per-format statistics from the oracle card dataset."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Dict, List, Any, Optional
from datetime import datetime
from math import ceil

from app.core import db

logger = logging.getLogger(__name__)


LEGAL_STATUSES = {"legal", "restricted"}
ARENA_FORMATS = ("alchemy", "historic", "brawl", "timeless")
IMAGE_PREFERENCE_ORDER = ("large", "normal", "png", "border_crop", "art_crop", "small")
AVAILABILITY_FILTERS = {"missing", "arena", "paper"}
DEFAULT_AVAILABILITY = "missing"
DATASET_NAME = "Scryfall Oracle"

FORMAT_METADATA: Dict[str, Dict[str, Any]] = {
    "standard": {"label": "Standard", "is_paper": True},
    "pioneer": {"label": "Pioneer", "is_paper": True},
    "modern": {"label": "Modern", "is_paper": True},
    "legacy": {"label": "Legacy", "is_paper": True},
    "vintage": {"label": "Vintage", "is_paper": True},
    "commander": {"label": "Commander / EDH", "is_paper": True},
    "oathbreaker": {"label": "Oathbreaker", "is_paper": True},
    "pauper": {"label": "Pauper", "is_paper": True},
    "paupercommander": {"label": "Pauper Commander", "is_paper": True},
    "predh": {"label": "PreDH", "is_paper": True},
    "duel": {"label": "Duel Commander", "is_paper": True},
    "premodern": {"label": "Premodern", "is_paper": True},
    "oldschool": {"label": "Old School", "is_paper": True},
    "brawl": {"label": "Brawl", "is_paper": True},
    "standardbrawl": {"label": "Standard Brawl", "is_paper": True},
    "penny": {"label": "Penny Dreadful", "is_paper": False},
    "future": {"label": "Future Standard", "is_paper": False},
    "alchemy": {"label": "Alchemy", "is_paper": False},
    "historic": {"label": "Historic", "is_paper": False},
    "timeless": {"label": "Timeless", "is_paper": False},
    "gladiator": {"label": "Gladiator", "is_paper": False},
}


def _resolve_label(format_code: str) -> str:
    meta = FORMAT_METADATA.get(format_code)
    if meta:
        return meta["label"]
    return format_code.replace("_", " ").title()


def _is_paper_format(format_code: str) -> bool:
    meta = FORMAT_METADATA.get(format_code)
    if meta is not None:
        return bool(meta["is_paper"])
    # Default assumption: unknown formats are paper if they are not in explicitly digital-only sets.
    return format_code not in {"alchemy", "historic", "timeless", "gladiator", "future"}


def _is_paper_legal_card(card: Dict[str, Any]) -> bool:
    games = set(card.get("games") or [])
    if "paper" in games:
        return True
    legalities = card.get("legalities") or {}
    for fmt, status in legalities.items():
        if status in LEGAL_STATUSES and _is_paper_format(fmt):
            return True
    return False


def _pick_image_from_dict(image_dict: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(image_dict, dict):
        return None
    for key in IMAGE_PREFERENCE_ORDER:
        uri = image_dict.get(key)
        if uri:
            return uri
    # Return any value if preferred keys were missing
    for uri in image_dict.values():
        if uri:
            return uri
    return None


def _get_primary_image_uri(card: Dict[str, Any]) -> Optional[str]:
    """Return the best-fit card image URI for single or multi-faced cards."""
    direct_uri = _pick_image_from_dict(card.get("image_uris"))
    if direct_uri:
        return direct_uri
    for face in card.get("card_faces") or []:
        face_uri = _pick_image_from_dict(face.get("image_uris"))
        if face_uri:
            return face_uri
    return None


def _get_arena_legal_formats(legalities: Dict[str, str]) -> List[str]:
    if not legalities:
        return []
    return [fmt for fmt in ARENA_FORMATS if legalities.get(fmt) in LEGAL_STATUSES]


def _is_arena_available(legalities: Dict[str, str]) -> bool:
    """A card is considered on Arena if it is legal in any Arena digital format."""
    return bool(_get_arena_legal_formats(legalities))


def _is_relevant_card(card: Dict[str, Any]) -> bool:
    """Return True if the card is legal (or restricted) in at least one format."""
    legalities = card.get("legalities") or {}
    return any(status in LEGAL_STATUSES for status in legalities.values())


def _cards_snapshot_key() -> float:
    """
    Use Postgres table stats to derive a cache key.

    We rely on last_analyze/last_autoanalyze timestamps because the import
    script runs ANALYZE right after swapping the staging table.
    """
    try:
        with db.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT EXTRACT(EPOCH FROM COALESCE(last_analyze, last_autoanalyze))
                    FROM pg_stat_user_tables
                    WHERE relname = 'cards'
                    LIMIT 1
                    """
                )
                row = cur.fetchone()
                if row and row[0] is not None:
                    return float(row[0])
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning(
            "Unable to read cards snapshot key from pg_stat_user_tables: %s", exc
        )
    # Fallback disables long-lived caching if stats are unavailable.
    return datetime.now().timestamp()


def _fetch_cards_from_db() -> List[Dict[str, Any]]:
    """Stream the Scryfall payloads from Postgres."""
    cards: List[Dict[str, Any]] = []
    try:
        with db.connect() as conn:
            with conn.cursor(name="format_stats_cards") as cur:
                cur.execute("SELECT data FROM cards")
                for (payload,) in cur:
                    if not isinstance(payload, dict):
                        raise RuntimeError("cards.data is not JSON")
                    cards.append(payload)
    except Exception as exc:
        raise RuntimeError(f"Failed to load cards from database: {exc}") from exc

    if not cards:
        raise RuntimeError("cards table is empty; run data import first.")
    return cards


@lru_cache(maxsize=1)
def _load_cards_snapshot(snapshot_key: float) -> List[Dict[str, Any]]:
    return _fetch_cards_from_db()


def _load_cards(snapshot_key: Optional[float] = None) -> List[Dict[str, Any]]:
    key = snapshot_key if snapshot_key is not None else _cards_snapshot_key()
    return _load_cards_snapshot(key)


def get_format_statistics() -> Dict[str, Any]:
    """Compute aggregate statistics per format using the oracle dataset."""
    snapshot_key = _cards_snapshot_key()
    cards = [card for card in _load_cards(snapshot_key) if _is_relevant_card(card)]
    totals: Dict[str, Dict[str, int]] = {}

    for card in cards:
        legalities = card.get("legalities") or {}
        is_paper = _is_paper_legal_card(card)
        arena_formats = _get_arena_legal_formats(legalities)
        is_arena = bool(arena_formats)

        for format_code, status in legalities.items():
            if status not in LEGAL_STATUSES:
                continue

            stats = totals.setdefault(
                format_code,
                {
                    "total_legal": 0,
                    "paper_legal": 0,
                    "arena_legal": 0,
                    "paper_and_arena": 0,
                    "paper_missing": 0,
                },
            )

            stats["total_legal"] += 1
            if is_paper:
                stats["paper_legal"] += 1
                if is_arena:
                    stats["paper_and_arena"] += 1
                else:
                    stats["paper_missing"] += 1
            if is_arena:
                stats["arena_legal"] += 1

    formatted_results: List[Dict[str, Any]] = []
    for format_code, stats in totals.items():
        paper_total = stats["paper_legal"]
        paper_available = stats["paper_and_arena"]
        paper_missing = stats["paper_missing"]
        label = _resolve_label(format_code)
        is_paper_format = _is_paper_format(format_code)

        coverage_pct = (
            round((paper_available / paper_total) * 100, 2) if paper_total else None
        )
        missing_pct = (
            round((paper_missing / paper_total) * 100, 2) if paper_total else None
        )

        formatted_results.append(
            {
                "code": format_code,
                "label": label,
                "is_paper_format": is_paper_format,
                "total_cards": stats["total_legal"],
                "paper_cards": paper_total,
                "arena_cards": stats["arena_legal"],
                "paper_available_on_arena": paper_available,
                "paper_missing_on_arena": paper_missing,
                "paper_coverage_percent": coverage_pct,
                "paper_missing_percent": missing_pct,
            }
        )

    formatted_results.sort(key=lambda item: (-item["total_cards"], item["label"]))
    paper_only = [item for item in formatted_results if item["is_paper_format"]]
    paper_missing_total = sum(item["paper_missing_on_arena"] for item in paper_only)
    paper_cards_total = sum(item["paper_cards"] for item in paper_only)
    paper_available_total = sum(item["paper_available_on_arena"] for item in paper_only)
    paper_average_coverage = (
        round((paper_available_total / paper_cards_total) * 100, 2)
        if paper_cards_total
        else None
    )

    updated_dt = datetime.fromtimestamp(snapshot_key)

    return {
        "all_formats": formatted_results,
        "paper_formats": paper_only,
        "formats_count": len(formatted_results),
        "paper_formats_count": len(paper_only),
        "paper_cards_total": paper_cards_total,
        "paper_missing_total": paper_missing_total,
        "paper_average_coverage": paper_average_coverage,
        "paper_available_total": paper_available_total,
        "total_cards": len(cards),
        "dataset_name": DATASET_NAME,
        "dataset_updated_at": snapshot_key,
        "dataset_updated_at_iso": updated_dt.isoformat(),
        "dataset_updated_at_display": updated_dt.strftime("%Y-%m-%d %H:%M"),
    }


def get_cards_for_format(
    format_code: str,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    availability: Optional[str] = None,
) -> Dict[str, Any]:
    """Return paginated list of cards for the given format."""
    normalized_code = (format_code or "").strip().lower()
    if not normalized_code:
        raise ValueError("format_code is required.")

    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    search_query = (search or "").strip().lower()
    availability_choice = (availability or DEFAULT_AVAILABILITY).strip().lower()
    if availability_choice not in AVAILABILITY_FILTERS:
        raise ValueError(
            f"Invalid availability filter '{availability}'. Expected one of {sorted(AVAILABILITY_FILTERS)}."
        )

    snapshot_key = _cards_snapshot_key()
    cards = [card for card in _load_cards(snapshot_key) if _is_relevant_card(card)]
    results: List[Dict[str, Any]] = []
    set_tracking: Dict[str, Dict[str, Any]] = {}

    for card in cards:
        legalities = card.get("legalities") or {}
        status = legalities.get(normalized_code)
        if status not in LEGAL_STATUSES:
            continue

        name = card.get("name", "")
        is_paper = _is_paper_legal_card(card)
        arena_formats = _get_arena_legal_formats(legalities)
        is_arena = bool(arena_formats)
        set_code = (card.get("set") or "unknown").lower()
        set_name = card.get("set_name") or (
            set_code.upper() if set_code != "unknown" else "Unknown Set"
        )

        if is_paper:
            coverage = set_tracking.setdefault(
                set_code,
                {
                    "set_code": set_code,
                    "set_name": set_name,
                    "paper_total": 0,
                    "paper_available": 0,
                    "paper_missing": 0,
                },
            )
            coverage["set_name"] = set_name
            coverage["paper_total"] += 1
            if is_arena:
                coverage["paper_available"] += 1
            else:
                coverage["paper_missing"] += 1

        if search_query and search_query not in name.lower():
            continue

        missing_on_arena = is_paper and not is_arena

        if availability_choice == "missing" and not missing_on_arena:
            continue
        if availability_choice == "arena" and not arena_formats:
            continue
        if availability_choice == "paper" and not is_paper:
            continue
        # other availability choices keep every qualifying card

        results.append(
            {
                "name": name,
                "set_name": card.get("set_name"),
                "set_code": card.get("set"),
                "collector_number": card.get("collector_number"),
                "rarity": card.get("rarity"),
                "released_at": card.get("released_at"),
                "mana_cost": card.get("mana_cost"),
                "type_line": card.get("type_line"),
                "oracle_text": card.get("oracle_text"),
                "is_paper": is_paper,
                "is_arena": is_arena,
                "missing_on_arena": missing_on_arena,
                "scryfall_uri": card.get("scryfall_uri"),
                "arena_formats": arena_formats,
                "image_uri": _get_primary_image_uri(card),
            }
        )

    results.sort(key=lambda card: card["name"])
    total = len(results)
    if availability_choice in {"missing", "arena", "paper"}:
        page = 1
        page_results = results
        total_pages = 1
        page_size = total or 1
    else:
        total_pages = max(1, ceil(total / page_size)) if total else 1
        if page > total_pages:
            page = total_pages
        start = (page - 1) * page_size
        end = start + page_size
        page_results = results[start:end]

    set_coverage_list: List[Dict[str, Any]] = []
    for coverage in set_tracking.values():
        paper_total = coverage["paper_total"]
        paper_available = coverage["paper_available"]
        paper_missing = coverage["paper_missing"]
        coverage["paper_completion_percent"] = (
            round((paper_available / paper_total) * 100, 2) if paper_total else None
        )
        coverage["paper_missing_percent"] = (
            round((paper_missing / paper_total) * 100, 2) if paper_total else None
        )
        set_coverage_list.append(coverage)

    return {
        "format_code": normalized_code,
        "format_label": _resolve_label(normalized_code),
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages if total else 1,
        "results": page_results,
        "availability": availability_choice,
        "set_coverage": set_coverage_list,
    }
