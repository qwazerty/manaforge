"""Card service for managing Magic cards via Scryfall API."""

import re
import time
from html import unescape
from urllib.parse import quote_plus, urlparse, urljoin
import aiohttp
from aiohttp import ClientError, ClientTimeout
from typing import List, Optional, Dict, Any, Tuple, Set, Union
from app.models.game import Card, Deck, DeckCard, CardType, Color, Rarity

DeckEntry = Union[Tuple[int, str], Tuple[int, str, Optional[str]]]


class CardService:
    """Service for managing Magic cards via Scryfall API."""

    _DEFAULT_HEADERS = {
        "User-Agent": "ManaForgeDeckImporter/1.0 (+https://manaforge.houke.fr/)"
    }
    
    def __init__(self):
        """Initialize the CardService without database dependency."""
        pass

    def _generate_deck_identity(self, preferred_name: Optional[str] = None) -> Tuple[str, str]:
        """
        Generate a deck identifier and name using a preferred name when available.
        """
        resolved_name = (preferred_name or "").strip()
        if not resolved_name:
            resolved_name = f"Imported Deck {int(time.time())}"

        deck_id = (
            resolved_name.lower()
            .replace(" ", "_")
            .replace("'", "")
            .replace(",", "")
            .replace("-", "_")
        )
        return deck_id, resolved_name

    def _strip_sideboard_lines(self, deck_text: str) -> str:
        """
        Remove sideboard sections from textual deck exports.
        """
        lines = deck_text.splitlines()
        qty_pattern = re.compile(r'^\s*(?:SB:)?\s*(\d+)')

        sideboard_start: Optional[int] = None
        main_quantity = 0

        for idx, raw_line in enumerate(lines):
            stripped = raw_line.strip()

            if not stripped:
                if sideboard_start is not None:
                    continue

                if main_quantity >= 40:
                    block_qty = 0
                    block_count = 0
                    lookahead = idx + 1
                    while lookahead < len(lines):
                        candidate = lines[lookahead].strip()
                        if not candidate:
                            break
                        match = qty_pattern.match(candidate)
                        if not match:
                            block_count = 0
                            break
                        block_qty += int(match.group(1))
                        block_count += 1
                        lookahead += 1

                    if block_count and 5 <= block_qty <= 25:
                        sideboard_start = idx
                        continue

                continue

            if re.match(r'^(//\s*)?sideboard', stripped, re.IGNORECASE):
                sideboard_start = idx
                break

            if stripped.lower().startswith("sb:"):
                sideboard_start = idx
                break

            match = qty_pattern.match(stripped)
            if match and sideboard_start is None:
                main_quantity += int(match.group(1))

        filtered: List[str] = []
        for idx, raw_line in enumerate(lines):
            if sideboard_start is not None and idx >= sideboard_start:
                break

            stripped = raw_line.strip()
            if not stripped:
                continue

            if re.match(r'^(//\s*)?sideboard', stripped, re.IGNORECASE):
                break
            if stripped.lower().startswith("sb:"):
                continue

            filtered.append(stripped)

        return "\n".join(filtered)
    
    async def get_card(self, card_id: str) -> Optional[Card]:
        """Get a card by ID using Scryfall API."""
        card_name = card_id.replace("_", " ").title()
        return await self.get_card_by_name(card_name)
    
    async def get_card_by_id(self, card_id: str) -> Optional[Card]:
        """Get a card by ID (alias for get_card)."""
        return await self.get_card(card_id)
    
    async def get_card_by_name(self, card_name: str) -> Optional[Card]:
        """Get a card by exact name using Scryfall API."""
        card_data = await self.get_card_data_from_scryfall(card_name)
        if card_data:
            return Card(**card_data)
        return None
    
    async def search_cards(self, query: str, limit: int = 20, card_type: Optional[str] = None) -> List[Card]:
        """Search cards by name using Scryfall API with optional type filtering (e.g., token, creature, instant, etc.)."""
        if not query.strip():
            return []
        
        try:
            # Build Scryfall query with optional type filter
            scryfall_query = query.replace(" ", "+")
            if card_type:
                scryfall_query = f"t:{card_type}+{scryfall_query}"
            
            url = (
                f"https://api.scryfall.com/cards/search?q={scryfall_query}"
                "&unique=cards&order=name"
            )
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        cards = []
                        
                        card_data_list = data.get("data", [])[:limit]
                        for scryfall_card in card_data_list:
                            card_data = self._parse_scryfall_card(scryfall_card)
                            if card_data:
                                cards.append(Card(**card_data))
                        
                        return cards
                    elif response.status == 404:
                        # No results found
                        return []
        except Exception as e:
            print(f"Error searching cards: {e}")
        
        return []
    
    async def _fetch_card_json(self, session: aiohttp.ClientSession, url: str) -> Optional[Dict[str, Any]]:
        """Helper to fetch JSON payload from Scryfall and handle errors gracefully."""
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
        except Exception as exc:
            print(f"Error fetching data from Scryfall ({url}): {exc}")
        return None

    async def get_card_data_from_scryfall(
        self, identifier: str, by_id: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Get complete card data from Scryfall API by name or ID."""
        if by_id:
            url = f"https://api.scryfall.com/cards/{identifier}"
        else:
            sanitized_identifier = identifier.strip()
            formatted_name = quote_plus(sanitized_identifier)
            url = f"https://api.scryfall.com/cards/named?exact={formatted_name}"

        try:
            async with aiohttp.ClientSession() as session:
                data = await self._fetch_card_json(session, url)
                if data:
                    return self._parse_scryfall_card(data)

                if not by_id:
                    # Fallback to fuzzy search for cards with alternate punctuation or formatting.
                    fuzzy_url = f"https://api.scryfall.com/cards/named?fuzzy={quote_plus(identifier)}"
                    data = await self._fetch_card_json(session, fuzzy_url)
                    if data:
                        return self._parse_scryfall_card(data)
        except Exception as e:
            print(f"Error fetching card data for {identifier}: {e}")
        
        return None
    
    def _parse_scryfall_card(
        self, scryfall_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse Scryfall card data into our Card model format."""
        card_faces_data = scryfall_data.get("card_faces", []) or []
        front_face = card_faces_data[0] if card_faces_data else None

        def _resolve_front_face_value(key: str, default: Any = None) -> Any:
            if front_face is not None:
                value = front_face.get(key)
                if value not in (None, ""):
                    return value
            return scryfall_data.get(key, default)

        def _infer_card_type(type_line_text: str) -> CardType:
            lowered = (type_line_text or "").lower()
            if "land" in lowered:
                return CardType.LAND
            if "creature" in lowered:
                return CardType.CREATURE
            if "instant" in lowered:
                return CardType.INSTANT
            if "sorcery" in lowered:
                return CardType.SORCERY
            if "enchantment" in lowered:
                return CardType.ENCHANTMENT
            if "artifact" in lowered:
                return CardType.ARTIFACT
            if "planeswalker" in lowered:
                return CardType.PLANESWALKER
            return CardType.CREATURE

        primary_type_line = _resolve_front_face_value("type_line", scryfall_data.get("type_line", "")) or ""
        card_type = _infer_card_type(primary_type_line)

        subtype = ""
        if "—" in primary_type_line:
            subtype = primary_type_line.split("—")[1].strip()
        elif " — " in primary_type_line:
            subtype = primary_type_line.split(" — ")[1].strip()

        colors = []
        scryfall_colors = scryfall_data.get("colors", [])
        for color in scryfall_colors:
            if color == "W":
                colors.append(Color.WHITE)
            elif color == "U":
                colors.append(Color.BLUE)
            elif color == "B":
                colors.append(Color.BLACK)
            elif color == "R":
                colors.append(Color.RED)
            elif color == "G":
                colors.append(Color.GREEN)
        
        rarity = Rarity.COMMON
        scryfall_rarity = scryfall_data.get("rarity", "common")
        if scryfall_rarity == "uncommon":
            rarity = Rarity.UNCOMMON
        elif scryfall_rarity == "rare":
            rarity = Rarity.RARE
        elif scryfall_rarity == "mythic":
            rarity = Rarity.MYTHIC

        image_url = None
        if "image_uris" in scryfall_data and "normal" in scryfall_data["image_uris"]:
            potential_url = scryfall_data["image_uris"]["normal"]
            if potential_url and "/back/" not in potential_url:
                image_url = potential_url
        elif "card_faces" in scryfall_data and len(scryfall_data["card_faces"]) > 0:
            for face in scryfall_data["card_faces"]:
                if "image_uris" in face and "normal" in face["image_uris"]:
                    potential_url = face["image_uris"]["normal"]
                    if potential_url and "/back/" not in potential_url:
                        image_url = potential_url
                        break

        card_id = scryfall_data["name"].lower().replace(
            " ", "_"
        ).replace("'", "").replace(",", "").replace("-", "_")
        import uuid
        unique_id = f"{card_id}_{uuid.uuid4().hex[:8]}"

        # Check if this is a double-faced card
        is_double_faced = "card_faces" in scryfall_data and len(scryfall_data["card_faces"]) > 1
        card_faces = []
        
        if is_double_faced:
            for i, face in enumerate(scryfall_data["card_faces"]):
                face_image_url = None
                if "image_uris" in face and "normal" in face["image_uris"]:
                    # Pour les cartes double faces, on accepte toutes les images, y compris celles avec "/back/"
                    face_image_url = face["image_uris"]["normal"]
                
                face_data = {
                    "name": face.get("name", scryfall_data["name"]),
                    "mana_cost": face.get("mana_cost", ""),
                    "type_line": face.get("type_line", ""),
                    "oracle_text": face.get("oracle_text", ""),
                    "power": face.get("power"),
                    "toughness": face.get("toughness"),
                    "image_url": face_image_url,
                    "is_front_face": i == 0,
                    "face_index": i
                }
                card_faces.append(face_data)

        # Initialize counters and loyalty for planeswalkers
        counters = {}
        loyalty = None
        
        if card_type == CardType.PLANESWALKER:
            # Extract starting loyalty from card text or use default
            loyalty_value = scryfall_data.get("loyalty")
            if loyalty_value is not None:
                try:
                    loyalty = int(loyalty_value)
                    counters["loyalty"] = loyalty
                except (ValueError, TypeError):
                    # Fallback to parsing from text if loyalty field is not numeric
                    oracle_text = scryfall_data.get("oracle_text", "")
                    loyalty_match = re.search(r"Starting loyalty (\d+)", oracle_text)
                    if loyalty_match:
                        loyalty = int(loyalty_match.group(1))
                        counters["loyalty"] = loyalty
                    else:
                        # Default loyalty if can't determine
                        loyalty = 3
                        counters["loyalty"] = loyalty

        return {
            "id": card_id,
            "scryfall_id": scryfall_data.get("id"),
            "unique_id": unique_id,
            "name": scryfall_data["name"],
            "mana_cost": _resolve_front_face_value("mana_cost", scryfall_data.get("mana_cost", "")),
            "cmc": scryfall_data.get("cmc", 0),
            "card_type": card_type,
            "subtype": subtype,
            "text": _resolve_front_face_value("oracle_text", scryfall_data.get("oracle_text", "")),
            "power": _resolve_front_face_value("power", scryfall_data.get("power")),
            "toughness": _resolve_front_face_value("toughness", scryfall_data.get("toughness")),
            "colors": colors,
            "rarity": rarity,
            "image_url": image_url,
            "is_double_faced": is_double_faced,
            "current_face": 0,
            "card_faces": card_faces,
            "counters": counters,
            "loyalty": loyalty,
        }
    
    async def _build_deck_from_entries(
        self,
        entries: List[DeckEntry],
        deck_name: Optional[str] = None
    ) -> Deck:
        """Build a deck object from parsed entries, keeping commanders separate."""
        deck_cards: List[DeckCard] = []
        commanders: List[Card] = []

        for entry in entries:
            if len(entry) == 3:
                quantity, card_name, section = entry
            else:
                quantity, card_name = entry
                section = None

            card_data = await self.get_card_data_from_scryfall(card_name)
            if not card_data:
                print(f"❌ Card not found: {card_name}")
                continue

            card = Card(**card_data)
            if section == "commander":
                commanders.extend(
                    card.model_copy(deep=True) for _ in range(max(1, quantity))
                )
                print(f"⭐ Identified commander: {card_name}")
                continue

            deck_card = DeckCard(card=card, quantity=quantity)
            deck_cards.append(deck_card)
            print(f"✅ Added {quantity}x {card_name}")

        deck_id, resolved_name = self._generate_deck_identity(deck_name)
        return Deck(
            id=deck_id,
            name=resolved_name,
            cards=deck_cards,
            commanders=commanders
        )

    async def parse_decklist(
        self,
        decklist_text: str,
        deck_name: Optional[str] = None
    ) -> Deck:
        """Parse a decklist in text format and create a Deck object."""
        normalized_text = self._strip_sideboard_lines(decklist_text).strip()
        lines = normalized_text.splitlines() if normalized_text else []

        card_entry_regex = re.compile(
            r"^\s*(\d+)\s+([^(]+?)(?:\s*\([^)]*\).*?)?$"
        )

        section_aliases = {
            "commander": "commander",
            "commanders": "commander",
            "commandeur": "commander",
            "commandeurs": "commander",
            "deck": "main",
            "main": "main",
            "maindeck": "main",
            "mainboard": "main",
            "main deck": "main",
            "compagnon": "companion",
            "companion": "companion"
        }

        current_section: Optional[str] = None
        entries: List[DeckEntry] = []
        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            match = card_entry_regex.match(line)
            if match:
                quantity = int(match.group(1))
                card_name = match.group(2).strip()
                section = current_section if current_section and current_section != "main" else None
                entries.append((quantity, card_name, section))
                continue

            normalized_heading = re.sub(r'[^a-zA-Z\s]', ' ', line).lower()
            normalized_heading = re.sub(r'\s+', ' ', normalized_heading).strip()
            if normalized_heading in section_aliases:
                current_section = section_aliases[normalized_heading]
                continue

        return await self._build_deck_from_entries(entries, deck_name=deck_name)

    async def _http_get_json(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Fetch a JSON payload with sane defaults and error handling."""
        timeout = ClientTimeout(total=20)
        request_headers = dict(self._DEFAULT_HEADERS)
        if headers:
            request_headers.update(headers)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=request_headers) as response:
                    if response.status != 200:
                        body = await response.text()
                        snippet = body.strip().splitlines()
                        preview = snippet[0][:120] if snippet else ""
                        if response.status in (401, 403):
                            raise ValueError(
                                "Scryfall returned an authorization error. "
                                "Ensure the deck is public or use the text export."
                            )
                        raise ValueError(
                            f"HTTP {response.status} while fetching {url}: {preview}"
                        )
                    return await response.json()
        except ClientError as exc:
            raise ValueError(f"Network error while fetching {url}: {exc}") from exc

    async def _http_get_text(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None
    ) -> str:
        """Fetch raw text content with sane defaults and error handling."""
        timeout = ClientTimeout(total=20)
        request_headers = dict(self._DEFAULT_HEADERS)
        if headers:
            request_headers.update(headers)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=request_headers) as response:
                    if response.status != 200:
                        body = await response.text()
                        snippet = body.strip().splitlines()
                        preview = snippet[0][:120] if snippet else ""
                        if response.status in (401, 403):
                            raise ValueError(
                                "Scryfall returned an authorization error. "
                                "Ensure the deck is public or use the text export."
                            )
                        raise ValueError(
                            f"HTTP {response.status} while fetching {url}: {preview}"
                        )
                    return await response.text()
        except ClientError as exc:
            raise ValueError(f"Network error while fetching {url}: {exc}") from exc

    async def _download_deck_text_and_name(
        self,
        source_url: str
    ) -> Tuple[str, Optional[str]]:
        """Detect provider and download deck text plus optional name."""
        normalized = (source_url or "").strip()
        if not normalized:
            raise ValueError("Deck URL cannot be empty.")

        parsed = urlparse(normalized)
        if not parsed.scheme:
            raise ValueError("Deck URL must include a scheme such as https://")

        host = parsed.netloc.split(":")[0].lower()

        if host.endswith("moxfield.com"):
            return await self._extract_deck_from_moxfield(parsed)
        if host.endswith("mtggoldfish.com"):
            return await self._extract_deck_from_mtggoldfish(parsed, normalized)
        if host == "api.scryfall.com":
            return await self._extract_deck_from_scryfall_api(parsed)
        if host.endswith("scryfall.com"):
            return await self._extract_deck_from_scryfall_site(normalized)

        raise ValueError(
            "Unsupported deck provider. Supported providers: Moxfield, Scryfall, MTGGoldfish."
        )

    async def _extract_deck_from_moxfield(
        self,
        parsed_url
    ) -> Tuple[str, Optional[str]]:
        """Fetch a deck from Moxfield by deck identifier."""
        segments = [segment for segment in parsed_url.path.split("/") if segment]
        deck_id: Optional[str] = None

        if segments:
            if segments[0] == "decks":
                if len(segments) >= 2:
                    deck_id = segments[1]
                    if deck_id == "all" and len(segments) >= 3:
                        deck_id = segments[2]
            elif segments[0] == "deck" and len(segments) >= 2:
                deck_id = segments[1]

        if deck_id:
            deck_id = deck_id.split("?")[0].split("#")[0]

        if not deck_id:
            raise ValueError("Unable to determine Moxfield deck identifier from URL.")

        api_url = f"https://api.moxfield.com/v2/decks/all/{deck_id}"
        payload = await self._http_get_json(api_url)

        deck_name = (
            payload.get("name")
            or payload.get("publicId")
            or payload.get("deck", {}).get("name")
            or f"Moxfield Deck {deck_id}"
        )

        boards_container = payload.get("boards") or payload.get("board") or {}
        if not isinstance(boards_container, dict):
            boards_container = {}

        def resolve_zone(*keys: str) -> Any:
            for key in keys:
                if key in boards_container:
                    return boards_container[key]
            for key in keys:
                if key in payload:
                    return payload[key]
            return None

        def iter_zone_entries(zone: Any) -> List[Dict[str, Any]]:
            if not zone:
                return []

            candidates: List[Any] = []

            if isinstance(zone, dict):
                for key in (
                    "cards",
                    "entries",
                    "items",
                    "boardCards",
                    "cardDtos",
                    "list",
                ):
                    value = zone.get(key)
                    if value:
                        candidates.append(value)

                if not candidates:
                    candidates.append(zone)
            else:
                candidates.append(zone)

            entries: List[Dict[str, Any]] = []
            for candidate in candidates:
                if isinstance(candidate, dict):
                    for value in candidate.values():
                        if isinstance(value, dict):
                            entries.append(value)
                elif isinstance(candidate, list):
                    for value in candidate:
                        if isinstance(value, dict):
                            entries.append(value)

            return entries

        def resolve_quantity(entry: Dict[str, Any], fallback: Optional[int]) -> Optional[int]:
            for key in (
                "quantity",
                "qty",
                "count",
                "number",
                "cardQuantity",
                "copies",
            ):
                value = entry.get(key)
                if isinstance(value, (int, float)):
                    return int(value)

            for nested_key in ("boardCard", "boardEntry", "boardItem"):
                nested = entry.get(nested_key)
                if isinstance(nested, dict):
                    qty = resolve_quantity(nested, None)
                    if qty:
                        return qty

            return fallback

        def resolve_card_name(entry: Dict[str, Any]) -> Optional[str]:
            for key in ("card", "cardDto", "card_data", "cardData", "cardInfo"):
                card_info = entry.get(key)
                if isinstance(card_info, dict):
                    name = card_info.get("name") or card_info.get("cardName")
                    if name:
                        return name
            return entry.get("name")

        entries_by_section: Dict[str, Dict[str, int]] = {
            "commander": {},
            "companion": {},
            "main": {}
        }

        zone_configs = [
            (("commanders", "commander"), 1, "commander"),
            (("companions", "companion"), 1, "companion"),
            (("mainboard", "mainBoard", "main"), None, "main"),
        ]

        for zone_keys, default_quantity, section_name in zone_configs:
            zone = resolve_zone(*zone_keys)
            for entry in iter_zone_entries(zone):
                quantity = resolve_quantity(entry, default_quantity)
                card_name = resolve_card_name(entry)
                if quantity and card_name:
                    section_bucket = entries_by_section.setdefault(section_name, {})
                    section_bucket[card_name] = section_bucket.get(card_name, 0) + int(quantity)

        total_entries = sum(len(bucket) for bucket in entries_by_section.values())

        if total_entries == 0:
            # Attempt plain-text export as fallback
            download_variants = [
                f"https://www.moxfield.com/decks/all/{deck_id}?format=txt",
                f"https://www.moxfield.com/decks/all/{deck_id}/download",
                f"https://www.moxfield.com/decks/all/{deck_id}/download?format=txt",
            ]
            for download_url in download_variants:
                try:
                    deck_text = (await self._http_get_text(download_url)).strip()
                    if deck_text:
                        return deck_text, deck_name
                except ValueError:
                    continue
            raise ValueError("Deck appears to be empty or unsupported on Moxfield.")

        def emit_section(title: str, bucket_key: str) -> List[str]:
            bucket = entries_by_section.get(bucket_key, {})
            if not bucket:
                return []
            section_lines = [title]
            section_lines.extend(f"{qty} {name}" for name, qty in bucket.items())
            section_lines.append("")  # Blank line after section for readability
            return section_lines

        lines: List[str] = []
        lines.extend(emit_section("Commander", "commander"))
        lines.extend(emit_section("Companion", "companion"))
        lines.extend(emit_section("Deck", "main"))

        deck_text = "\n".join(lines).strip()
        return deck_text, deck_name

    def _extract_mtggoldfish_deck_ids(self, page_html: str) -> List[str]:
        """Extract potential deck identifiers from MTGGoldfish HTML."""
        if not page_html:
            return []

        ids: List[str] = []

        patterns = [
            r'data-deck-id="(\d+)"',
            r'href="/deck/(?:arena_download/|download/|visual/)?(\d+)"',
            r'href="https?://(?:www\.)?mtggoldfish\.com/deck/(?:arena_download/|download/|visual/)?(\d+)"',
            r'https?://(?:www\.)?mtggoldfish\.com/deck/popout\?id=(\d+)',
            r'href="/deck/registration\?id=(\d+)"',
            r'href="https?://(?:www\.)?mtggoldfish\.com/deck/registration\?id=(\d+)"'
        ]

        for pattern in patterns:
            ids.extend(re.findall(pattern, page_html, re.IGNORECASE))
        seen: Set[str] = set()
        unique_ids: List[str] = []
        for deck_id in ids:
            if deck_id not in seen:
                seen.add(deck_id)
                unique_ids.append(deck_id)
        return unique_ids

    def _extract_mtggoldfish_archetype_paths(self, page_html: str, platform: str) -> List[str]:
        """Extract archetype paths from a metagame page, preferring the selected platform."""
        if not page_html:
            return []

        matches = re.findall(
            r'href="(?:https?://(?:www\.)?mtggoldfish\.com)?(/archetype/[a-z0-9\-_.]+)(?:#[^\"]*)?"',
            page_html,
            re.IGNORECASE
        )

        preferred_fragment = "paper" if platform == "paper" else "online"
        order: List[str] = []
        selected: Dict[str, str] = {}

        for match in matches:
            normalized = match.strip()
            if not normalized:
                continue

            base_path, _, fragment = normalized.partition("#")
            fragment = fragment.lower()

            if base_path not in selected:
                order.append(base_path)
                selected[base_path] = normalized

            if preferred_fragment and fragment == preferred_fragment:
                selected[base_path] = f"{base_path}#{fragment}" if fragment else base_path
                continue

            existing_fragment = selected[base_path].partition("#")[2].lower()
            if not existing_fragment and fragment:
                selected[base_path] = normalized

        archetypes: List[str] = []
        for base_path in order:
            chosen = selected.get(base_path, base_path)
            chosen_base, _, chosen_fragment = chosen.partition("#")
            chosen_fragment = chosen_fragment.lower()
            if preferred_fragment and chosen_fragment != preferred_fragment:
                chosen = f"{chosen_base}#{preferred_fragment}"
            archetypes.append(chosen)

        return archetypes

    def _select_mtggoldfish_deck_id(
        self,
        deck_ids: List[str],
        page_html: str,
        platform: str
    ) -> Optional[str]:
        """Choose the most appropriate deck identifier for the requested platform."""
        if not deck_ids:
            return None

        anchor_pattern = re.compile(
            r'<a[^>]+href="[^\"]*/deck/(?:arena_download/|download/|visual/)?(\d+)[^\"]*"[^>]*>\s*Deck\s+Page\s*</a>',
            re.IGNORECASE
        )

        platform_token = "tabletop" if platform == "paper" else "magic online"

        for match in anchor_pattern.finditer(page_html):
            candidate_id = match.group(1)
            window_start = max(0, match.start() - 1200)
            context = page_html[window_start:match.start()]
            if re.search(platform_token, context, re.IGNORECASE):
                return candidate_id

        return deck_ids[0]

    async def _resolve_mtggoldfish_archetype_deck(
        self,
        archetype_path: str,
        normalized_format: str,
        normalized_platform: str,
        metagame_url: str
    ) -> Optional[Dict[str, str]]:
        """Fetch the representative deck for an archetype entry."""

        if not archetype_path:
            return None

        base_url = "https://www.mtggoldfish.com"
        archetype_url = urljoin(base_url, archetype_path.lstrip("/"))

        try:
            page_html = await self._http_get_text(archetype_url)
        except Exception:
            return None

        deck_ids = self._extract_mtggoldfish_deck_ids(page_html)
        if not deck_ids:
            return None

        selected_id = self._select_mtggoldfish_deck_id(deck_ids, page_html, normalized_platform)
        if not selected_id:
            return None

        anchor = "#paper" if normalized_platform == "paper" else "#online"
        canonical_archetype_url = f"{archetype_url}{anchor}"

        return {
            "deck_id": selected_id,
            "deck_url": f"https://www.mtggoldfish.com/deck/{selected_id}",
            "format": normalized_format,
            "platform": normalized_platform,
            "metagame_url": metagame_url,
            "archetype_url": canonical_archetype_url
        }

    async def fetch_mtggoldfish_metagame_deck_urls(
        self,
        format_slug: str = "modern",
        limit: int = 2,
        platform: str = "paper"
    ) -> List[Dict[str, str]]:
        """
        Fetch deck URLs for the top decks of a MTGGoldfish metagame page.
        """
        normalized_format = (format_slug or "modern").strip().lower().replace(" ", "_")
        normalized_platform = (platform or "paper").strip().lower()

        try:
            deck_limit = max(1, int(limit))
        except (TypeError, ValueError):
            deck_limit = 1

        base_url = f"https://www.mtggoldfish.com/metagame/{normalized_format}"
        query_suffix = ""
        if normalized_platform == "paper":
            query_suffix = "?paper=1"
        elif normalized_platform in {"mtgo", "online"}:
            query_suffix = "?mtgo=1"

        candidate_urls: List[str] = []

        def enqueue(url: str) -> None:
            if url and url not in candidate_urls:
                candidate_urls.append(url)

        enqueue(base_url)
        enqueue(f"{base_url}/full")
        if query_suffix:
            enqueue(f"{base_url}{query_suffix}")
            enqueue(f"{base_url}/full{query_suffix}")

        page_html: Optional[str] = None
        first_html: Optional[str] = None
        deck_ids: List[str] = []
        last_error: Optional[Exception] = None

        for url in candidate_urls:
            try:
                candidate_html = await self._http_get_text(url)
            except Exception as exc:
                last_error = exc
                continue
            if first_html is None:
                first_html = candidate_html
            ids = self._extract_mtggoldfish_deck_ids(candidate_html)
            if ids:
                page_html = candidate_html
                deck_ids = ids
                break

        decks: List[Dict[str, str]] = []
        resolved_ids: Set[str] = set()
        anchor = "#paper" if normalized_platform == "paper" else "#online"
        metagame_url = f"{base_url}{anchor}"

        archetype_paths = self._extract_mtggoldfish_archetype_paths(first_html or "", normalized_platform)
        for archetype_path in archetype_paths:
            if len(decks) >= deck_limit:
                break
            deck_info = await self._resolve_mtggoldfish_archetype_deck(
                archetype_path=archetype_path,
                normalized_format=normalized_format,
                normalized_platform=normalized_platform,
                metagame_url=metagame_url
            )
            if not deck_info:
                continue
            deck_id = deck_info.get("deck_id")
            if not deck_id or deck_id in resolved_ids:
                continue
            resolved_ids.add(deck_id)
            decks.append(deck_info)

        if len(decks) < deck_limit and deck_ids:
            for deck_id in deck_ids:
                if deck_id in resolved_ids:
                    continue
                decks.append(
                    {
                        "deck_id": deck_id,
                        "deck_url": f"https://www.mtggoldfish.com/deck/{deck_id}",
                        "format": normalized_format,
                        "platform": normalized_platform,
                        "metagame_url": metagame_url,
                        "archetype_url": ""
                    }
                )
                resolved_ids.add(deck_id)
                if len(decks) >= deck_limit:
                    break

        if not decks:
            detail = f"Unable to locate deck identifiers on MTGGoldfish for format '{normalized_format}'."
            if last_error:
                detail = f"{detail} Last error: {last_error}"
            raise ValueError(detail)

        if len(decks) < deck_limit:
            detail = f"Only located {len(decks)} deck(s) on MTGGoldfish for format '{normalized_format}'."
            if last_error:
                detail = f"{detail} Last error: {last_error}"
            raise ValueError(detail)

        return decks

    async def _extract_deck_from_mtggoldfish(
        self,
        parsed_url,
        original_url: str
    ) -> Tuple[str, Optional[str]]:
        """Fetch a deck from MTGGoldfish."""
        segments = [segment for segment in parsed_url.path.split("/") if segment]
        deck_id: Optional[str] = None

        if "arena_download" in segments:
            idx = segments.index("arena_download")
            if idx + 1 < len(segments):
                deck_id = segments[idx + 1]
        elif "download" in segments:
            idx = segments.index("download")
            if idx + 1 < len(segments):
                deck_id = segments[idx + 1]
        elif "deck" in segments:
            idx = segments.index("deck")
            if idx + 1 < len(segments):
                deck_id = segments[idx + 1]

        if deck_id:
            deck_id = deck_id.split("?")[0].split("#")[0]

        page_html: Optional[str] = None

        if not deck_id:
            page_html = await self._http_get_text(original_url)
            deck_ids = self._extract_mtggoldfish_deck_ids(page_html)
            if deck_ids:
                deck_id = deck_ids[0]

        if deck_id:
            deck_text = ""
            deck_name = f"Deck {deck_id}"

            arena_url = f"https://www.mtggoldfish.com/deck/arena_download/{deck_id}"
            try:
                arena_html = await self._http_get_text(arena_url)
                textarea_match = re.search(
                    r"<textarea[^>]*>(.*?)</textarea>",
                    arena_html,
                    re.IGNORECASE | re.DOTALL
                )
                if textarea_match:
                    deck_text = unescape(textarea_match.group(1)).strip()
            except ValueError:
                arena_html = ""

            if not deck_text:
                download_url = f"https://www.mtggoldfish.com/deck/download/{deck_id}?format=txt"
                deck_text = (await self._http_get_text(download_url)).strip()

            if not deck_text:
                raise ValueError("Deck download from MTGGoldfish returned empty content.")

            if page_html is None:
                try:
                    page_html = await self._http_get_text(f"https://www.mtggoldfish.com/deck/{deck_id}")
                except ValueError:
                    page_html = None

            if page_html:
                title_match = re.search(r"<title>(.*?)</title>", page_html, re.IGNORECASE | re.DOTALL)
                if title_match:
                    raw_title = unescape(title_match.group(1))
                    deck_name = (
                        raw_title.split("»")[0]
                        .split("|")[0]
                        .replace("Deck: ", "")
                        .strip()
                        or deck_name
                    )

            return deck_text, deck_name

        # Fall back to parsing archetype or other summary pages directly.
        if page_html is None:
            page_html = await self._http_get_text(original_url)

        deck_text, deck_name = self._parse_mtggoldfish_deck_table(page_html)
        if deck_text:
            if not deck_name:
                title_match = re.search(r"<title>(.*?)</title>", page_html, re.IGNORECASE | re.DOTALL)
                if title_match:
                    raw_title = unescape(title_match.group(1))
                    deck_name = raw_title.split("|")[0].strip() or None
            return deck_text, deck_name

        deck_ids = self._extract_mtggoldfish_deck_ids(page_html)
        if deck_ids:
            deck_id = deck_ids[0]
            download_url = f"https://www.mtggoldfish.com/deck/download/{deck_id}?format=txt"
            deck_text = (await self._http_get_text(download_url)).strip()
            if not deck_text:
                raise ValueError("Deck download from MTGGoldfish returned empty content.")

            try:
                deck_page_html = await self._http_get_text(f"https://www.mtggoldfish.com/deck/{deck_id}")
            except ValueError:
                deck_page_html = ""

            deck_name = f"Deck {deck_id}"
            if deck_page_html:
                title_match = re.search(r"<title>(.*?)</title>", deck_page_html, re.IGNORECASE | re.DOTALL)
                if title_match:
                    raw_title = unescape(title_match.group(1))
                    deck_name = (
                        raw_title.split("»")[0]
                        .split("|")[0]
                        .replace("Deck: ", "")
                        .strip()
                        or deck_name
                    )

            return deck_text, deck_name

        raise ValueError("Unable to determine MTGGoldfish deck identifier from URL.")

    def _parse_mtggoldfish_deck_table(self, page_html: str) -> Tuple[str, Optional[str]]:
        """Parse deck entries from an MTGGoldfish HTML deck table."""

        def strip_tags(value: str) -> str:
            cleaned = re.sub(r"<[^>]+>", " ", value)
            cleaned = re.sub(r"\s+", " ", cleaned)
            return unescape(cleaned).strip()

        entry_pattern = re.compile(
            r'<td[^>]*class="deck-col-qty"[^>]*>(.*?)</td>\s*'
            r'<td[^>]*class="deck-col-card"[^>]*>(.*?)</td>',
            re.IGNORECASE | re.DOTALL
        )

        entries: List[str] = []
        for qty_html, card_html in entry_pattern.findall(page_html):
            qty_text = strip_tags(qty_html)
            card_text_raw = strip_tags(card_html)

            digits = re.findall(r"\d+", qty_text)
            if not digits:
                continue

            quantity = int(digits[0])
            lowered_card = card_text_raw.strip().lower()
            if re.match(r'^(//\s*)?sideboard', card_text_raw.strip(), re.IGNORECASE):
                continue
            if lowered_card.startswith("sb:"):
                continue

            card_name = card_text_raw.replace("SB:", "").strip()
            card_name = re.sub(r"\s+", " ", card_name)

            if not card_name:
                continue

            entries.append(f"{quantity} {card_name}")

        deck_text = "\n".join(entries)
        if not deck_text.strip():
            return "", None

        return deck_text, None

    async def _fetch_scryfall_deck_by_id(
        self,
        deck_id: str
    ) -> Tuple[str, Optional[str]]:
        """Fetch deck metadata and export text from Scryfall API."""
        export_url = f"https://api.scryfall.com/decks/{deck_id}/export/text"
        deck_text = (await self._http_get_text(export_url)).strip()

        if not deck_text:
            raise ValueError("Scryfall deck export returned empty content.")

        deck_name: Optional[str] = None
        metadata_url = f"https://api.scryfall.com/decks/{deck_id}"
        try:
            metadata = await self._http_get_json(metadata_url)
            deck_name = metadata.get("name") or metadata.get("slug")
        except ValueError:
            deck_name = None

        if not deck_name:
            deck_name = f"Scryfall Deck {deck_id}"

        return deck_text, deck_name

    async def _extract_deck_from_scryfall_site(
        self,
        original_url: str
    ) -> Tuple[str, Optional[str]]:
        """Fetch a deck from the public Scryfall site."""
        page_html = await self._http_get_text(original_url)

        deck_id_match = re.search(
            r'data-deck-id="([0-9a-f-]+)"', page_html, re.IGNORECASE
        )

        if not deck_id_match:
            raise ValueError("Unable to locate Scryfall deck identifier on the page.")

        deck_id = deck_id_match.group(1)
        return await self._fetch_scryfall_deck_by_id(deck_id)

    async def _extract_deck_from_scryfall_api(
        self,
        parsed_url
    ) -> Tuple[str, Optional[str]]:
        """Fetch a deck using the Scryfall API hostname."""
        segments = [segment for segment in parsed_url.path.split("/") if segment]
        deck_id: Optional[str] = None

        if len(segments) >= 2 and segments[0] == "decks":
            deck_id = segments[1]

        if not deck_id:
            raise ValueError("Unable to determine Scryfall deck identifier from URL.")

        return await self._fetch_scryfall_deck_by_id(deck_id)

    async def import_deck_from_url(self, source_url: str) -> Dict[str, Any]:
        """
        Import a deck from a supported URL and return both text and parsed deck.
        """
        deck_text, preferred_name = await self._download_deck_text_and_name(source_url)
        normalized_text = self._strip_sideboard_lines(deck_text).strip()
        if not normalized_text:
            raise ValueError("Deck download returned empty decklist.")

        deck = await self.parse_decklist(normalized_text, deck_name=preferred_name)
        return {
            "deck": deck,
            "deck_text": normalized_text,
            "deck_name": deck.name
        }
