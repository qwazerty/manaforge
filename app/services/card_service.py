"""
Card service for managing Magic cards database.
"""

import re
import aiohttp
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.game import Card, Deck, DeckCard, CardType, Color, Rarity


class CardService:
    """Service for managing Magic cards."""
    
    def __init__(self, database: AsyncIOMotorDatabase):
        self.db = database
        self.collection = database.cards
    
    async def get_card(self, card_id: str) -> Optional[Card]:
        """Get a card by ID."""
        card_data = await self.collection.find_one({"id": card_id})
        if card_data:
            return Card(**card_data)
        return None
    
    async def get_card_by_id(self, card_id: str) -> Optional[Card]:
        """Get a card by ID (alias for get_card)."""
        return await self.get_card(card_id)
    
    async def search_cards(self, query: str, limit: int = 20) -> List[Card]:
        """Search cards by name."""
        cursor = self.collection.find(
            {"name": {"$regex": query, "$options": "i"}},
            limit=limit
        )
        cards = []
        async for card_data in cursor:
            cards.append(Card(**card_data))
        return cards
    
    async def get_cards_by_type(self, card_type: CardType) -> List[Card]:
        """Get cards by type."""
        cursor = self.collection.find({"card_type": card_type})
        cards = []
        async for card_data in cursor:
            cards.append(Card(**card_data))
        return cards
    
    async def get_card_image_url(self, card_name: str) -> Optional[str]:
        """Get Scryfall image URL for a card."""
        # Format the card name for Scryfall API
        formatted_name = card_name.lower().replace(" ", "+").replace("'", "").replace(",", "")
        
        # Scryfall API endpoint for card images
        scryfall_url = f"https://api.scryfall.com/cards/named?exact={formatted_name}"
        
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(scryfall_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Return the normal resolution image URL
                        if "image_uris" in data and "normal" in data["image_uris"]:
                            return data["image_uris"]["normal"]
                        elif "card_faces" in data and len(data["card_faces"]) > 0:
                            # Handle double-faced cards
                            return data["card_faces"][0].get("image_uris", {}).get("normal")
        except Exception as e:
            print(f"Error fetching image for {card_name}: {e}")
        
        return None

    async def get_card_data_from_scryfall(self, card_name: str) -> Optional[Dict[str, Any]]:
        """Get complete card data from Scryfall API."""
        # Format the card name for Scryfall API
        formatted_name = card_name.lower().replace(" ", "+").replace("'", "").replace(",", "")
        
        # Scryfall API endpoint for complete card data
        scryfall_url = f"https://api.scryfall.com/cards/named?exact={formatted_name}"
        
        try:
            import aiohttp
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

        # Get image URL
        image_url = None
        if "image_uris" in scryfall_data and "normal" in scryfall_data["image_uris"]:
            image_url = scryfall_data["image_uris"]["normal"]
        elif "card_faces" in scryfall_data and len(scryfall_data["card_faces"]) > 0:
            # Handle double-faced cards
            image_url = scryfall_data["card_faces"][0].get("image_uris", {}).get("normal")

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
    
    async def initialize_sample_data(self) -> None:
        """Initialize database with sample cards fetched from Scryfall API."""
        
        print("🔄 Initializing sample card data from Scryfall API...")
        
        # List of card names to fetch from Scryfall
        sample_card_names = [
            "Lightning Bolt",
            "Grizzly Bears",
            "Counterspell",
            "Serra Angel",
            "Dark Ritual",
            "Mountain",
            "Forest",
            "Island",
            "Plains",
            "Swamp",
            "Arena of Glory",
            "Arid Mesa",
            "Blood Crypt",
            "Consign to Memory",
            "Flooded Strand",
            "Leyline Binding",
            "Leyline of the Guildpact",
            "Phlage, Titan of Fire's Fury",
            "Psychic Frog",
            "Ragavan, Nimble Pilferer",
            "Raucous Theater",
            "Sacred Foundry",
            "Scion of Draco",
            "Spara's Headquarters",
            "Steam Vents",
            "Stubborn Denial",
            "Temple Garden",
            "Territorial Kavu",
            "Tribal Flames",
            "Winternight Stories",
            "Wooded Foothills",
            "Xander's Lounge"
        ]
        
        # Fetch card data from Scryfall
        sample_cards = []
        for card_name in sample_card_names:
            print(f"📡 Fetching {card_name}...")
            card_data = await self.get_card_data_from_scryfall(card_name)
            if card_data:
                sample_cards.append(card_data)
                print(f"✅ {card_name}: Success")
            else:
                print(f"❌ {card_name}: Failed to fetch")
        
        # Use upsert to update existing cards or insert new ones
        for card in sample_cards:
            await self.collection.replace_one(
                {"id": card["id"]}, 
                card, 
                upsert=True
            )
        
        print(f"✅ Successfully upserted {len(sample_cards)} cards from Scryfall API")
    
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
        
        # Upsert the deck into the database
        await self.db.decks.replace_one({"id": deck_id}, deck.dict(), upsert=True)
        
        return deck
