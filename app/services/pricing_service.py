"""
Pricing service that loads price data into memory at startup.
Data is loaded once and served from RAM for all subsequent requests.
"""

import logging
from typing import Dict, Any, Optional, List

from app.core import db

logger = logging.getLogger(__name__)

# In-memory storage for pricing data
_price_guide_data: Optional[Dict[str, Any]] = None
_products_data: Optional[Dict[str, Any]] = None
_is_loaded: bool = False

# Optimized lookups built at startup
_price_by_product_id: Dict[int, float] = {}
_product_ids_by_name: Dict[str, List[int]] = {}


def load_pricing_data() -> None:
    """
    Load pricing data from JSON files into memory.
    Called once at application startup.
    """
    global _price_guide_data, _products_data, _is_loaded

    if _is_loaded:
        logger.debug("Pricing data already loaded, skipping.")
        return

    # Map to legacy structures for minimal impact on call sites
    price_guides: List[Dict[str, Any]] = []
    products: List[Dict[str, Any]] = []

    try:
        with db.connect() as conn:
            # Use server-side cursor to stream results and avoid memory spike
            with conn.cursor(name="pricing_loader") as cur:
                cur.execute(
                    """
                    SELECT id, name, normalized_name, alt_names, id_category, id_expansion,
                           id_metacard, date_added, price, price_avg, price_low, price_trend,
                           price_avg1, price_avg7, price_avg30, price_avg_foil, price_low_foil,
                           price_trend_foil, price_avg1_foil, price_avg7_foil, price_avg30_foil,
                           data, product
                    FROM cardmarket_price
                    """
                )
                for row in cur:
                    (
                        pid,
                        name,
                        normalized_name,
                        alt_names,
                        id_category,
                        id_expansion,
                        id_metacard,
                        date_added,
                        price,
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
                        data_json,
                        product_json,
                    ) = row

                    # price guide entry shape
                    pg = {
                        "idProduct": pid,
                        "idCategory": id_category,
                        "avg": price_avg,
                        "low": price_low,
                        "trend": price_trend,
                        "avg1": price_avg1,
                        "avg7": price_avg7,
                        "avg30": price_avg30,
                        "avg-foil": price_avg_foil,
                        "low-foil": price_low_foil,
                        "trend-foil": price_trend_foil,
                        "avg1-foil": price_avg1_foil,
                        "avg7-foil": price_avg7_foil,
                        "avg30-foil": price_avg30_foil,
                    }
                    price_guides.append(pg)

                    # product entry shape (minimal fields we relied on)
                    prod = {
                        "idProduct": pid,
                        "name": name,
                        "idCategory": id_category,
                        "idExpansion": id_expansion,
                        "idMetacard": id_metacard,
                        "dateAdded": date_added,
                    }
                    products.append(prod)
    except Exception as exc:
        raise RuntimeError(f"Failed to load pricing data from DB: {exc}") from exc

    _price_guide_data = {"priceGuides": price_guides}
    _products_data = {"products": products}

    # Build optimized lookups
    _build_price_lookup()
    _build_product_lookup()

    _is_loaded = True
    logger.info(
        f"Pricing data loaded from DB: {len(_price_by_product_id)} "
        f"prices, {len(_product_ids_by_name)} product names indexed."
    )


def _build_price_lookup() -> None:
    """Build price lookup by product ID."""
    global _price_by_product_id
    _price_by_product_id = {}

    if not _price_guide_data or "priceGuides" not in _price_guide_data:
        return

    for entry in _price_guide_data["priceGuides"]:
        product_id = entry.get("idProduct")
        if product_id is None:
            continue

        try:
            product_id = int(product_id)
        except (ValueError, TypeError):
            continue

        # Prefer trend, then avg, then low
        price = None
        for key in ("trend", "avg", "low"):
            val = entry.get(key)
            if val is not None:
                try:
                    price = float(val)
                    if price > 0:
                        break
                except (ValueError, TypeError):
                    continue

        if price is not None and price > 0:
            _price_by_product_id[product_id] = price


def _add_product_name_mapping(product_id: int, name: str) -> None:
    """
    Store a normalized name -> product ID mapping, avoiding duplicates.

    We normalize by trimming whitespace and lowercasing so lookups are
    case-insensitive and resilient to minor formatting differences.
    """
    normalized_name = str(name).strip().lower()
    if not normalized_name:
        return

    bucket = _product_ids_by_name.setdefault(normalized_name, [])
    if product_id not in bucket:
        bucket.append(product_id)


def _build_product_lookup() -> None:
    """Build product ID lookup by normalized card name."""
    global _product_ids_by_name
    _product_ids_by_name = {}

    if not _products_data or "products" not in _products_data:
        return

    for product in _products_data["products"]:
        product_id = product.get("idProduct")
        name = product.get("name")

        if product_id is None or not name:
            continue

        try:
            product_id = int(product_id)
        except (ValueError, TypeError):
            continue

        # Index the full name
        _add_product_name_mapping(product_id, name)

        # Also index each face of double-faced / meld cards so lookups work
        # when only the front-face name is provided (e.g., "Fang, Fearless l'Cie").
        if "//" in name:
            for face_name in name.split("//"):
                _add_product_name_mapping(product_id, face_name)

    logger.info("Pricing data loaded into memory successfully.")


def get_price_guide() -> Dict[str, Any]:
    """
    Get the price guide data from memory.
    Loads data if not already loaded.
    """
    if not _is_loaded:
        load_pricing_data()
    return _price_guide_data or {"priceGuides": []}


def get_products() -> Dict[str, Any]:
    """
    Get the products data from memory.
    Loads data if not already loaded.
    """
    if not _is_loaded:
        load_pricing_data()
    return _products_data or {"products": []}


def is_loaded() -> bool:
    """Check if pricing data has been loaded."""
    return _is_loaded


def get_memory_usage() -> Dict[str, Any]:
    """Get approximate memory usage of loaded data."""
    import sys

    price_guide_size = sys.getsizeof(_price_guide_data) if _price_guide_data else 0
    products_size = sys.getsizeof(_products_data) if _products_data else 0

    # For nested structures, this is approximate
    if _price_guide_data and "priceGuides" in _price_guide_data:
        price_guide_size += sum(
            sys.getsizeof(item) for item in _price_guide_data["priceGuides"][:100]
        ) * (len(_price_guide_data["priceGuides"]) // 100 + 1)

    if _products_data and "products" in _products_data:
        products_size += sum(
            sys.getsizeof(item) for item in _products_data["products"][:100]
        ) * (len(_products_data["products"]) // 100 + 1)

    return {
        "loaded": _is_loaded,
        "price_guide_entries": (
            len(_price_guide_data.get("priceGuides", [])) if _price_guide_data else 0
        ),
        "products_entries": (
            len(_products_data.get("products", [])) if _products_data else 0
        ),
        "indexed_prices": len(_price_by_product_id),
        "indexed_names": len(_product_ids_by_name),
        "approximate_size_mb": round(
            (price_guide_size + products_size) / 1024 / 1024, 2
        ),
    }


def lookup_prices(card_names: List[str]) -> Dict[str, Optional[float]]:
    """
    Look up prices for a list of card names.
    Returns a dict mapping card name -> price (or None if not found).

    This is optimized for batch lookups - call once with all card names
    rather than multiple times with individual names.
    """
    if not _is_loaded:
        load_pricing_data()

    results: Dict[str, Optional[float]] = {}

    for name in card_names:
        if not name:
            continue

        # Normalize the name
        normalized = str(name).strip().lower()

        # Look up product IDs for this name
        product_ids = _product_ids_by_name.get(normalized, [])

        if not product_ids:
            results[name] = None
            continue

        # Find the best (lowest) price among all product IDs for this card
        best_price: Optional[float] = None
        for pid in product_ids:
            price = _price_by_product_id.get(pid)
            if price is not None:
                if best_price is None or price < best_price:
                    best_price = price

        results[name] = best_price

    return results


def lookup_price_by_product_id(product_id: int) -> Optional[float]:
    """Look up price by Cardmarket product ID."""
    if not _is_loaded:
        load_pricing_data()
    return _price_by_product_id.get(product_id)
