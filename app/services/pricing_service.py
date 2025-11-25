"""
Pricing service that loads price data into memory at startup.
Data is loaded once and served from RAM for all subsequent requests.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# In-memory storage for pricing data
_price_guide_data: Optional[Dict[str, Any]] = None
_products_data: Optional[Dict[str, Any]] = None
_is_loaded: bool = False


def get_data_path() -> Path:
    """Get the path to the data directory."""
    # Navigate from app/services/ to project root/data/
    current_file = Path(__file__)
    project_root = current_file.parent.parent.parent
    return project_root / "data"


def load_pricing_data() -> None:
    """
    Load pricing data from JSON files into memory.
    Called once at application startup.
    """
    global _price_guide_data, _products_data, _is_loaded
    
    if _is_loaded:
        logger.debug("Pricing data already loaded, skipping.")
        return
    
    data_path = get_data_path()
    
    # Load price guide
    price_guide_path = data_path / "price_guide_1.json"
    if price_guide_path.exists():
        try:
            with open(price_guide_path, "r", encoding="utf-8") as f:
                _price_guide_data = json.load(f)
            logger.info(f"Loaded price guide data: {price_guide_path} ({price_guide_path.stat().st_size / 1024 / 1024:.1f} MB)")
        except Exception as e:
            logger.error(f"Failed to load price guide: {e}")
            _price_guide_data = {"priceGuides": []}
    else:
        logger.warning(f"Price guide file not found: {price_guide_path}")
        _price_guide_data = {"priceGuides": []}
    
    # Load products data
    products_path = data_path / "products_singles_1.json"
    if products_path.exists():
        try:
            with open(products_path, "r", encoding="utf-8") as f:
                _products_data = json.load(f)
            logger.info(f"Loaded products data: {products_path} ({products_path.stat().st_size / 1024 / 1024:.1f} MB)")
        except Exception as e:
            logger.error(f"Failed to load products data: {e}")
            _products_data = {"products": []}
    else:
        logger.warning(f"Products file not found: {products_path}")
        _products_data = {"products": []}
    
    _is_loaded = True
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
        price_guide_size += sum(sys.getsizeof(item) for item in _price_guide_data["priceGuides"][:100]) * (len(_price_guide_data["priceGuides"]) // 100 + 1)
    
    if _products_data and "products" in _products_data:
        products_size += sum(sys.getsizeof(item) for item in _products_data["products"][:100]) * (len(_products_data["products"]) // 100 + 1)
    
    return {
        "loaded": _is_loaded,
        "price_guide_entries": len(_price_guide_data.get("priceGuides", [])) if _price_guide_data else 0,
        "products_entries": len(_products_data.get("products", [])) if _products_data else 0,
        "approximate_size_mb": round((price_guide_size + products_size) / 1024 / 1024, 2)
    }
