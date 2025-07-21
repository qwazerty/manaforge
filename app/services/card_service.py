"""Card service for managing Magic cards via Scryfall API."""

import re
import aiohttp
from typing import List, Optional, Dict, Any
from app.models.game import Card, Deck, DeckCard, CardType, Color, Rarity


class CardService:
    """Service for managing Magic cards via Scryfall API."""
    
    def __init__(self):
        """Initialize the CardService without database dependency."""
        pass
    
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
    
    async def search_cards(self, query: str, limit: int = 20) -> List[Card]:
        """Search cards by name using Scryfall API."""
        if not query.strip():
            return []
        
        try:
            formatted_query = query.replace(" ", "+")
            url = (
                f"https://api.scryfall.com/cards/search?q={formatted_query}"
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
        except Exception as e:
            print(f"Error searching cards: {e}")
        
        return []
    
    async def get_card_data_from_scryfall(
        self, card_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get complete card data from Scryfall API."""
        formatted_name = card_name.lower().replace(
            " ", "+"
        ).replace("'", "").replace(",", "")
        
        url = f"https://api.scryfall.com/cards/named?exact={formatted_name}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_scryfall_card(data)
        except Exception as e:
            print(f"Error fetching card data for {card_name}: {e}")
        
        return None
    
    def _parse_scryfall_card(
        self, scryfall_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse Scryfall card data into our Card model format."""
        type_line = scryfall_data.get("type_line", "").lower()
        card_type = CardType.CREATURE
        
        if "instant" in type_line:
            card_type = CardType.INSTANT
        elif "sorcery" in type_line:
            card_type = CardType.SORCERY
        elif "enchantment" in type_line:
            card_type = CardType.ENCHANTMENT
        elif "artifact" in type_line:
            card_type = CardType.ARTIFACT
        elif "planeswalker" in type_line:
            card_type = CardType.PLANESWALKER
        elif "land" in type_line:
            card_type = CardType.LAND
        elif "creature" in type_line:
            card_type = CardType.CREATURE
        
        subtype = ""
        if "—" in scryfall_data.get("type_line", ""):
            subtype = scryfall_data["type_line"].split("—")[1].strip()
        elif " — " in scryfall_data.get("type_line", ""):
            subtype = scryfall_data["type_line"].split(" — ")[1].strip()

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
                    "image_url": face_image_url
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
            "unique_id": unique_id,
            "name": scryfall_data["name"],
            "mana_cost": scryfall_data.get("mana_cost", ""),
            "cmc": scryfall_data.get("cmc", 0),
            "card_type": card_type,
            "subtype": subtype,
            "text": scryfall_data.get("oracle_text", ""),
            "power": scryfall_data.get("power"),
            "toughness": scryfall_data.get("toughness"),
            "colors": colors,
            "rarity": rarity,
            "image_url": image_url,
            "is_double_faced": is_double_faced,
            "current_face": 0,
            "card_faces": card_faces,
            "counters": counters,
            "loyalty": loyalty
        }
    
    async def parse_decklist(self, decklist_text: str) -> Deck:
        """Parse a decklist in text format and create a Deck object."""
        lines = decklist_text.strip().split("\n")
        
        import time
        deck_name = f"Imported Deck {int(time.time())}"
        
        card_entry_regex = re.compile(
            r"^\s*(\d+)\s+([^(]+?)(?:\s*\([^)]*\).*?)?$"
        )
        
        deck_cards = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
                
            match = card_entry_regex.match(line)
            if match:
                quantity = int(match.group(1))
                card_name = match.group(2).strip()
                
                card_data = await self.get_card_data_from_scryfall(card_name)
                if card_data:
                    card = Card(**card_data)
                    deck_card = DeckCard(card=card, quantity=quantity)
                    deck_cards.append(deck_card)
                    print(f"✅ Added {quantity}x {card_name}")
                else:
                    print(f"❌ Card not found: {card_name}")
        
        deck_id = deck_name.lower().replace(
            " ", "_"
        ).replace("'", "").replace(",", "").replace("-", "_")
        deck = Deck(id=deck_id, name=deck_name, cards=deck_cards)
        
        return deck
