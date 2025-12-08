"""Text normalization utilities shared across the application."""

import re
import unicodedata


def normalize_name(name: str) -> str:
    """
    Normalize a card name for comparison and lookup.

    This function:
    - Removes diacritics (accents)
    - Lowercases the string
    - Normalizes apostrophe variants
    - Converts dashes and separators to spaces
    - Collapses multiple spaces

    Args:
        name: The card name to normalize

    Returns:
        A normalized string suitable for comparison
    """
    if not isinstance(name, str):
        return ""

    # Unicode normalization to decompose characters
    normalized = unicodedata.normalize("NFKD", name)

    # Remove combining characters (accents)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))

    # Lowercase and strip
    normalized = normalized.lower().strip()

    # Normalize apostrophe variants
    normalized = normalized.replace("'", "'").replace("`", "'").replace("´", "'")

    # Convert dash variants to spaces
    normalized = re.sub(r"[–—-]", " ", normalized)

    # Convert common separators to spaces
    normalized = re.sub(r"[,:/]", " ", normalized)

    # Collapse multiple spaces
    normalized = re.sub(r"\s+", " ", normalized)

    return normalized
