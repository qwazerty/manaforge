"""Utilities for computing per-format statistics from the oracle card dataset."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from math import ceil


LEGAL_STATUSES = {"legal", "restricted"}
ARENA_FORMATS = {"alchemy", "historic", "brawl", "timeless"}
AVAILABILITY_FILTERS = {"missing", "arena", "paper", "all"}
DEFAULT_AVAILABILITY = "missing"

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


def _is_arena_available(legalities: Dict[str, str]) -> bool:
    """A card is considered on Arena if it is legal in any Arena digital format."""
    for arena_format in ARENA_FORMATS:
        if legalities.get(arena_format) in LEGAL_STATUSES:
            return True
    return False


def _is_relevant_card(card: Dict[str, Any]) -> bool:
    """Return True if the card is legal (or restricted) in at least one format."""
    legalities = card.get("legalities") or {}
    return any(status in LEGAL_STATUSES for status in legalities.values())


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _latest_oracle_file() -> Path:
    data_dir = _project_root() / "data"
    candidates = sorted(data_dir.glob("oracle-cards-*.json"))
    if not candidates:
        raise FileNotFoundError("No oracle card dataset found in the data/ directory.")
    return candidates[-1]


@lru_cache(maxsize=1)
def _load_cards_snapshot(mtime: float) -> List[Dict[str, Any]]:
    data_file = _latest_oracle_file()
    with data_file.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _load_cards() -> List[Dict[str, Any]]:
    data_file = _latest_oracle_file()
    mtime = data_file.stat().st_mtime
    return _load_cards_snapshot(mtime)


def get_format_statistics() -> Dict[str, Any]:
    """Compute aggregate statistics per format using the oracle dataset."""
    cards = [card for card in _load_cards() if _is_relevant_card(card)]
    totals: Dict[str, Dict[str, int]] = {}

    for card in cards:
        legalities = card.get("legalities") or {}
        games = set(card.get("games") or [])
        is_paper = "paper" in games
        is_arena = _is_arena_available(legalities)

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
            round((paper_available / paper_total) * 100, 2)
            if paper_total
            else None
        )
        missing_pct = (
            round((paper_missing / paper_total) * 100, 2)
            if paper_total
            else None
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

    formatted_results.sort(
        key=lambda item: (-item["total_cards"], item["label"])
    )
    paper_only = [item for item in formatted_results if item["is_paper_format"]]
    paper_missing_total = sum(item["paper_missing_on_arena"] for item in paper_only)
    paper_cards_total = sum(item["paper_cards"] for item in paper_only)
    paper_available_total = sum(item["paper_available_on_arena"] for item in paper_only)
    paper_average_coverage = (
        round((paper_available_total / paper_cards_total) * 100, 2)
        if paper_cards_total
        else None
    )

    latest_file = _latest_oracle_file()
    latest_mtime = latest_file.stat().st_mtime
    updated_dt = datetime.fromtimestamp(latest_mtime)

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
        "dataset_name": latest_file.name,
        "dataset_updated_at": latest_mtime,
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
        raise ValueError(f"Invalid availability filter '{availability}'. Expected one of {sorted(AVAILABILITY_FILTERS)}.")

    cards = [card for card in _load_cards() if _is_relevant_card(card)]
    results: List[Dict[str, Any]] = []
    set_tracking: Dict[str, Dict[str, Any]] = {}

    for card in cards:
        legalities = card.get("legalities") or {}
        status = legalities.get(normalized_code)
        if status not in LEGAL_STATUSES:
            continue

        name = card.get("name", "")
        games = set(card.get("games") or [])
        is_paper = "paper" in games
        is_arena = _is_arena_available(legalities)
        set_code = (card.get("set") or "unknown").lower()
        set_name = card.get("set_name") or (set_code.upper() if set_code != "unknown" else "Unknown Set")

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
        if availability_choice == "arena" and not is_arena:
            continue
        if availability_choice == "paper" and not is_paper:
            continue
        # availability_choice == "all" keeps everything

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
            }
        )

    results.sort(key=lambda card: card["name"])
    total = len(results)
    if availability_choice == "missing":
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
