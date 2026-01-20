"""
Pricing service that queries the database directly.
No in-memory caching - relies on PostgreSQL for performance.
"""

import logging
from typing import Dict, Any, Optional, List

from app.backend.core import db

logger = logging.getLogger(__name__)


def load_pricing_data() -> None:
    """
    No-op for backward compatibility.
    Previously loaded data into memory; now queries are done directly.
    """
    pass


def get_pricing_status() -> Dict[str, Any]:
    """Get status of the pricing data in the database."""
    try:
        with db.connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM cardmarket_price")
                count = cur.fetchone()[0]
                return {
                    "mode": "sql",
                    "total_products": count,
                }
    except Exception as e:
        logger.error(f"Failed to get pricing status: {e}")
        return {"mode": "sql", "error": str(e)}


def lookup_prices(card_names: List[str]) -> Dict[str, Optional[float]]:
    """
    Look up prices for a list of card names via SQL.
    Returns a dict mapping card name -> price (or None if not found).

    Uses normalized_name column for case-insensitive matching.
    For double-faced cards, also checks if the name matches a face.
    """
    if not card_names:
        return {}

    results: Dict[str, Optional[float]] = {name: None for name in card_names if name}

    # Normalize names for lookup
    normalized_map: Dict[str, str] = {}
    for name in card_names:
        if name:
            normalized_map[name.strip().lower()] = name

    if not normalized_map:
        return results

    normalized_list = list(normalized_map.keys())

    try:
        with db.connect() as conn:
            with conn.cursor() as cur:
                # Query by normalized name, picking the best price (trend > avg > low)
                # Also match on face names for double-faced cards
                cur.execute(
                    """
                    SELECT normalized_name,
                           COALESCE(
                               NULLIF(price_trend, 0),
                               NULLIF(price_avg, 0),
                               NULLIF(price_low, 0)
                           ) as price
                    FROM cardmarket_price
                    WHERE normalized_name = ANY(%s)
                    """,
                    (normalized_list,),
                )

                for row in cur:
                    normalized_name, price = row
                    if normalized_name in normalized_map and price:
                        original_name = normalized_map[normalized_name]
                        current = results.get(original_name)
                        # Keep the lowest price if multiple matches
                        if current is None or price < current:
                            results[original_name] = float(price)

                # For names not found, try matching as a face of double-faced card
                missing = [n for n in normalized_list if results.get(normalized_map[n]) is None]
                if missing:
                    # Search for cards where name contains the search term before or after //
                    for norm_name in missing:
                        cur.execute(
                            """
                            SELECT COALESCE(
                                       NULLIF(price_trend, 0),
                                       NULLIF(price_avg, 0),
                                       NULLIF(price_low, 0)
                                   ) as price
                            FROM cardmarket_price
                            WHERE normalized_name LIKE %s
                               OR normalized_name LIKE %s
                            ORDER BY price ASC NULLS LAST
                            LIMIT 1
                            """,
                            (f"{norm_name} //%", f"%// {norm_name}"),
                        )
                        row = cur.fetchone()
                        if row and row[0]:
                            original_name = normalized_map[norm_name]
                            results[original_name] = float(row[0])

    except Exception as e:
        logger.error(f"Failed to lookup prices: {e}")

    return results


def lookup_price_by_product_id(product_id: int) -> Optional[float]:
    """Look up price by Cardmarket product ID."""
    try:
        with db.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COALESCE(
                               NULLIF(price_trend, 0),
                               NULLIF(price_avg, 0),
                               NULLIF(price_low, 0)
                           )
                    FROM cardmarket_price
                    WHERE id = %s
                    """,
                    (product_id,),
                )
                row = cur.fetchone()
                if row and row[0]:
                    return float(row[0])
    except Exception as e:
        logger.error(f"Failed to lookup price by product ID: {e}")
    return None
