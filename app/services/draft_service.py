"""
Service for managing draft-related logic, such as sets and boosters.
"""
import re
import aiohttp
import random
from urllib.parse import urlparse, parse_qs
from typing import List, Dict, Any, Optional, Tuple

from app.models.game import Card, Rarity
from app.services.card_service import CardService

class DraftService:
    """Service for managing draft-related logic."""

    def __init__(self, card_service: CardService):
        self.card_service = card_service

    async def search_sets(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for MTG sets using the Scryfall API."""
        url = "https://api.scryfall.com/sets"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return []

                data = await response.json()

        all_sets = data.get("data", [])
        allowed_set_types = {"core", "expansion", "masters", "draft_innovation", "cube"}
        filtered_sets = [
            s
            for s in all_sets
            if s.get("set_type") in allowed_set_types
        ]

        if query:
            normalized_query = query.strip().lower()
            filtered_sets = [
                s
                for s in filtered_sets
                if normalized_query in s.get("name", "").lower()
            ]

        filtered_sets.sort(
            key=lambda s: s.get("released_at") or "",
            reverse=True
        )

        return [
            {
                "code": s.get("code"),
                "name": s.get("name"),
                "icon_svg_uri": s.get("icon_svg_uri"),
                "released_at": s.get("released_at"),
            }
            for s in filtered_sets
        ]

    async def generate_booster(self, set_code: str) -> List[Card]:
        """Generate a random booster pack for a given set."""
        # Standard booster distribution: 10 commons, 3 uncommons, 1 rare/mythic
        # This is a simplified model. Real boosters can be more complex.
        
        commons = await self._get_cards_by_rarity(set_code, "common", 10)
        uncommons = await self._get_cards_by_rarity(set_code, "uncommon", 3)
        
        # 1 in 8 chance for a mythic, otherwise a rare
        if random.randint(1, 8) == 1:
            rare_mythic = await self._get_cards_by_rarity(set_code, "mythic", 1)
        else:
            rare_mythic = await self._get_cards_by_rarity(set_code, "rare", 1)

        # If no mythic was found, get a rare instead
        if not rare_mythic:
            rare_mythic = await self._get_cards_by_rarity(set_code, "rare", 1)

        booster = commons + uncommons + rare_mythic
        
        rarity_order = {Rarity.MYTHIC: 0, Rarity.RARE: 1, Rarity.UNCOMMON: 2, Rarity.COMMON: 3}
        booster.sort(key=lambda card: rarity_order.get(card.rarity, 4))

        return booster

    async def _get_cards_by_rarity(self, set_code: str, rarity: str, count: int) -> List[Card]:
        """Get a number of random cards of a specific rarity from a set."""
        all_cards_data = self.card_service.get_local_cards(
            set_code=set_code,
            rarity=rarity,
            include_tokens=False
        )

        if not all_cards_data:
            return []

        sampled_cards_data = random.sample(all_cards_data, min(count, len(all_cards_data)))

        cards = []
        for card_data in sampled_cards_data:
            parsed_card = self.card_service._parse_scryfall_card(card_data)
            if parsed_card:
                cards.append(Card(**parsed_card))
        return cards

    async def load_cube_pool(
        self,
        source_url: Optional[str],
        raw_list: Optional[str],
        preferred_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Load a cube card pool from either a CubeCobra URL or pasted list.
        Returns templates that can be cloned into booster packs.
        """
        normalized_url = (source_url or "").strip()
        normalized_text = (raw_list or "").strip()

        cube_id: Optional[str] = None
        cube_name: Optional[str] = (preferred_name or "").strip() or None
        download_url: Optional[str] = None

        if normalized_url:
            download_url, cube_id, discovered_name = await self._resolve_cube_download_url(normalized_url)
            if discovered_name and not cube_name:
                cube_name = discovered_name
        elif not normalized_text:
            raise ValueError("Provide either a CubeCobra URL or paste a cube list.")

        cube_payload_text = normalized_text
        if download_url:
            cube_payload_text = (await self.card_service._http_get_text(download_url)).strip()

        if not cube_payload_text:
            raise ValueError("Cube list appears to be empty.")

        resolved_name = cube_name or "Custom Cube"
        normalized_text = self.card_service._strip_sideboard_lines(cube_payload_text).strip()
        card_entries = self._parse_cube_list_entries(normalized_text)
        card_pool = []
        for entry in card_entries:
            quantity = max(1, entry.get("quantity", 1))
            name = entry.get("name")
            if not name:
                continue
            card_pool.extend([name] * quantity)
        if not card_pool:
            raise ValueError("Parsed cube list does not contain any cards.")
        if len(card_pool) < 15:
            raise ValueError("Cube list must contain at least 15 cards.")

        return {
            "card_pool": card_pool,
            "cube_id": cube_id,
            "cube_name": resolved_name,
            "card_count": len(card_pool),
            "source_url": normalized_url or download_url,
            "set_code": f"cube:{cube_id}" if cube_id else "cube"
        }

    def _parse_cube_list_entries(self, cube_text: str) -> List[Dict[str, Any]]:
        """Parse a plain text cube list into quantity/name entries."""
        if not cube_text:
            return []

        lines = cube_text.splitlines()
        card_entry_regex = re.compile(
            r"^\s*(\d+)\s+([^(]+?)(?:\s*\([^)]*\).*?)?$"
        )
        section_aliases = {
            "commander": "commander",
            "commanders": "commander",
            "deck": "main",
            "main": "main",
            "maindeck": "main",
            "mainboard": "main",
            "main deck": "main",
            "companion": "companion",
            "sideboard": "sideboard"
        }

        current_section: Optional[str] = None
        entries: List[Dict[str, Any]] = []
        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            # Check for section headers first
            normalized_heading = re.sub(r'[^a-zA-Z\s]', ' ', line).lower()
            normalized_heading = re.sub(r'\s+', ' ', normalized_heading).strip()
            if normalized_heading in section_aliases:
                current_section = section_aliases[normalized_heading]
                continue

            match = card_entry_regex.match(line)
            if match:
                quantity = int(match.group(1))
                card_name = match.group(2).strip()
                entries.append({
                    "quantity": quantity,
                    "name": card_name,
                    "section": current_section
                })
                continue

            # Fallback: assume it's just a card name (quantity 1)
            # Match name with optional set code/collector number in parentheses
            name_match = re.match(r"^([^(]+?)(?:\s*\([^)]*\).*?)?$", line)
            if name_match:
                card_name = name_match.group(1).strip()
                if card_name:
                    entries.append({
                        "quantity": 1,
                        "name": card_name,
                        "section": current_section
                    })

        return entries

    async def _resolve_cube_download_url(self, source_url: str) -> Tuple[str, Optional[str], Optional[str]]:
        """Resolve a CubeCobra download link and cube metadata from a public URL."""
        parsed = urlparse(source_url)
        if not parsed.scheme:
            raise ValueError("Cube URL must include a scheme such as https://")

        host = parsed.netloc.lower()
        segments = [segment for segment in parsed.path.split("/") if segment]
        cube_id = None
        cube_name_hint: Optional[str] = None

        path_identifier, path_name_hint = self._extract_cube_identifier_from_segments(segments)
        if path_identifier:
            cube_id = path_identifier
            cube_name_hint = path_name_hint

        if not cube_id:
            query_identifier = self._extract_cube_identifier_from_query(parsed.query)
            if query_identifier:
                cube_id = query_identifier
                if not self._looks_like_hex_identifier(query_identifier):
                    cube_name_hint = self._prettify_cube_name(query_identifier)

        if "cubecobra.com" not in host:
            raise ValueError("Cube URL must point to CubeCobra.")

        if not cube_id:
            raise ValueError("Unable to determine cube identifier from CubeCobra URL.")

        download_url = f"https://cubecobra.com/cube/download/mtgo/{cube_id}"
        if not cube_name_hint and not self._looks_like_hex_identifier(cube_id):
            cube_name_hint = self._prettify_cube_name(cube_id)
        return download_url, cube_id, cube_name_hint

    def _extract_cube_identifier_from_segments(self, segments: List[str]) -> Tuple[Optional[str], Optional[str]]:
        """Extract cube identifier and optional name hint from known CubeCobra routes."""
        if not segments or segments[0] != "cube":
            return None, None

        identifier: Optional[str] = None
        name_hint: Optional[str] = None

        if len(segments) >= 4 and segments[1] == "download":
            identifier = segments[3]
        else:
            skip_sections = {
                "list",
                "overview",
                "blog",
                "analysis",
                "compare",
                "playtest",
                "details",
                "stats"
            }
            if len(segments) >= 3 and segments[1] in skip_sections:
                identifier = segments[2]
            elif len(segments) >= 2:
                identifier = segments[1]

        sanitized = self._sanitize_cube_identifier(identifier)
        if not sanitized:
            return None, None

        if not self._looks_like_hex_identifier(sanitized):
            name_hint = self._prettify_cube_name(sanitized)

        return sanitized, name_hint

    def _extract_cube_identifier_from_query(self, query: str) -> Optional[str]:
        """Extract cube identifier from query parameters."""
        if not query:
            return None
        params = parse_qs(query)
        normalized_params = {k.lower(): v for k, v in params.items() if v}
        for key in ("cube", "id", "cube_id"):
            values = normalized_params.get(key)
            if not values:
                continue
            identifier = self._sanitize_cube_identifier(values[0])
            if identifier:
                return identifier
        return None

    def _sanitize_cube_identifier(self, identifier: Optional[str]) -> Optional[str]:
        """Ensure the cube identifier contains only safe characters."""
        if not identifier:
            return None
        candidate = identifier.strip().strip("/").split("?")[0].split("#")[0]
        if not candidate:
            return None
        if not re.fullmatch(r"[A-Za-z0-9_-]{3,}", candidate):
            return None
        return candidate

    def _prettify_cube_name(self, identifier: str) -> str:
        """Convert a slug-like identifier into a display name."""
        cleaned = identifier.replace("_", " ").replace("-", " ").strip()
        return cleaned.title() if cleaned else identifier

    def _looks_like_hex_identifier(self, identifier: Optional[str]) -> bool:
        """Return True if the identifier matches CubeCobra's hex IDs."""
        if not identifier:
            return False
        return bool(re.fullmatch(r"[a-f0-9]{24}", identifier, re.IGNORECASE))
