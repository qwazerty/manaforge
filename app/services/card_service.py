"""
Card service for managing Magic cards via Scryfall API.
"""

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
        # Convert card_id back to card name (reverse the transformation)
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
            # Format query for Scryfall search API
            formatted_query = query.replace(" ", "+")
            scryfall_url = f"https://api.scryfall.com/cards/search?q={formatted_query}&unique=cards&order=name"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(scryfall_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        cards = []
                        
                        # Process search results
                        card_data_list = data.get("data", [])[:limit]
                        for scryfall_card in card_data_list:
                            card_data = self._parse_scryfall_card(scryfall_card)
                            if card_data:
                                cards.append(Card(**card_data))
                        
                        return cards
        except Exception as e:
            print(f"Error searching cards: {e}")
        
        return []
    
    async def get_card_data_from_scryfall(self, card_name: str) -> Optional[Dict[str, Any]]:
        """Get complete card data from Scryfall API."""
        # Format the card name for Scryfall API
        formatted_name = card_name.lower().replace(" ", "+").replace("'", "").replace(",", "")
        
        # Scryfall API endpoint for complete card data
        scryfall_url = f"https://api.scryfall.com/cards/named?exact={formatted_name}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(scryfall_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_scryfall_card(data)
        except Exception as e:
            print(f"Error fetching card data for {card_name}: {e}")
        
        return None
    
    def _parse_scryfall_card(self, scryfall_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Scryfall card data into our Card model format."""
        # Map Scryfall type line to our CardType enum
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
        
        # Extract subtype (everything after the dash)
        subtype = ""
        if "—" in scryfall_data.get("type_line", ""):
            subtype = scryfall_data["type_line"].split("—")[1].strip()
        elif " — " in scryfall_data.get("type_line", ""):
            subtype = scryfall_data["type_line"].split(" — ")[1].strip()

        # Map colors
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
        
        # Map rarity
        rarity = Rarity.COMMON
        scryfall_rarity = scryfall_data.get("rarity", "common")
        if scryfall_rarity == "uncommon":
            rarity = Rarity.UNCOMMON
        elif scryfall_rarity == "rare":
            rarity = Rarity.RARE
        elif scryfall_rarity == "mythic":
            rarity = Rarity.MYTHIC

        # Get image URL with improved validation
        image_url = None
        if "image_uris" in scryfall_data and "normal" in scryfall_data["image_uris"]:
            potential_url = scryfall_data["image_uris"]["normal"]
            # Validate the URL doesn't contain problematic paths
            if potential_url and "/back/" not in potential_url:
                image_url = potential_url
        elif "card_faces" in scryfall_data and len(scryfall_data["card_faces"]) > 0:
            # Handle double-faced cards - prefer the front face
            for face in scryfall_data["card_faces"]:
                if "image_uris" in face and "normal" in face["image_uris"]:
                    potential_url = face["image_uris"]["normal"]
                    # Validate the URL doesn't contain problematic paths
                    if potential_url and "/back/" not in potential_url:
                        image_url = potential_url
                        break

        # Create unique ID from name
        card_id = scryfall_data["name"].lower().replace(" ", "_").replace("'", "").replace(",", "").replace("-", "_")

        return {
            "id": card_id,
            "name": scryfall_data["name"],
            "mana_cost": scryfall_data.get("mana_cost", ""),
            "cmc": scryfall_data.get("cmc", 0),
            "card_type": card_type,
            "subtype": subtype,
            "text": scryfall_data.get("oracle_text", ""),
            "power": scryfall_data.get("power") if scryfall_data.get("power") not in [None, "*"] else None,
            "toughness": scryfall_data.get("toughness") if scryfall_data.get("toughness") not in [None, "*"] else None,
            "colors": colors,
            "rarity": rarity,
            "image_url": image_url
        }
    
    async def parse_decklist(self, decklist_text: str) -> Deck:
        """Parse a decklist in text format and create a Deck object."""
        lines = decklist_text.strip().split("\n")
        
        # Generate a default deck name based on timestamp
        import time
        deck_name = f"Imported Deck {int(time.time())}"
        
        # Regular expression to match card entries: quantity + card name, ignoring content in parentheses
        # Format: "4 Lightning Bolt (M10) 146" -> captures "4" and "Lightning Bolt"
        card_entry_regex = re.compile(r"^\s*(\d+)\s+([^(]+?)(?:\s*\([^)]*\).*)?$")
        
        deck_cards = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):  # Skip empty lines and comments
                continue
                
            match = card_entry_regex.match(line)
            if match:
                quantity = int(match.group(1))
                card_name = match.group(2).strip()
                
                # Fetch card data from Scryfall
                card_data = await self.get_card_data_from_scryfall(card_name)
                if card_data:
                    # Create Card object
                    card = Card(**card_data)
                    # Create DeckCard with quantity
                    deck_card = DeckCard(card=card, quantity=quantity)
                    deck_cards.append(deck_card)
                    print(f"✅ Added {quantity}x {card_name}")
                else:
                    print(f"❌ Card not found: {card_name}")
        
        # Create and return the Deck object
        deck_id = deck_name.lower().replace(" ", "_").replace("'", "").replace(",", "").replace("-", "_")
        deck = Deck(id=deck_id, name=deck_name, cards=deck_cards)
        
        return deck
