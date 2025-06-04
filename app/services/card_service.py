"""
Card service for managing Magic cards database.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.game import Card, CardType, Color, Rarity


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
    
    async def initialize_sample_data(self) -> None:
        """Initialize database with sample cards for POC."""
        
        print("🔄 Initializing/updating sample card data with images...")
        
        # Always update cards to ensure they have image URLs
        sample_cards_data = [
            {
                "id": "lightning_bolt",
                "name": "Lightning Bolt",
                "mana_cost": "R",
                "cmc": 1,
                "card_type": CardType.INSTANT,
                "text": "Lightning Bolt deals 3 damage to any target.",
                "colors": [Color.RED],
                "rarity": Rarity.COMMON
            },
            {
                "id": "grizzly_bears",
                "name": "Grizzly Bears", 
                "mana_cost": "1G",
                "cmc": 2,
                "card_type": CardType.CREATURE,
                "subtype": "Bear",
                "power": 2,
                "toughness": 2,
                "colors": [Color.GREEN],
                "rarity": Rarity.COMMON
            },
            {
                "id": "counterspell",
                "name": "Counterspell",
                "mana_cost": "UU", 
                "cmc": 2,
                "card_type": CardType.INSTANT,
                "text": "Counter target spell.",
                "colors": [Color.BLUE],
                "rarity": Rarity.COMMON
            },
            {
                "id": "serra_angel",
                "name": "Serra Angel",
                "mana_cost": "3WW",
                "cmc": 5,
                "card_type": CardType.CREATURE,
                "subtype": "Angel",
                "text": "Flying, vigilance",
                "power": 4,
                "toughness": 4,
                "colors": [Color.WHITE],
                "rarity": Rarity.UNCOMMON
            },
            {
                "id": "dark_ritual",
                "name": "Dark Ritual", 
                "mana_cost": "B",
                "cmc": 1,
                "card_type": CardType.INSTANT,
                "text": "Add BBB.",
                "colors": [Color.BLACK],
                "rarity": Rarity.COMMON
            },
            {
                "id": "mountain",
                "name": "Mountain",
                "mana_cost": "",
                "cmc": 0,
                "card_type": CardType.LAND,
                "subtype": "Mountain",
                "text": "T: Add R.",
                "colors": [],
                "rarity": Rarity.COMMON
            },
            {
                "id": "forest",
                "name": "Forest",
                "mana_cost": "",
                "cmc": 0,
                "card_type": CardType.LAND,
                "subtype": "Forest", 
                "text": "T: Add G.",
                "colors": [],
                "rarity": Rarity.COMMON
            },
            {
                "id": "island",
                "name": "Island",
                "mana_cost": "",
                "cmc": 0,
                "card_type": CardType.LAND,
                "subtype": "Island",
                "text": "T: Add U.", 
                "colors": [],
                "rarity": Rarity.COMMON
            },
            {
                "id": "plains",
                "name": "Plains",
                "mana_cost": "",
                "cmc": 0,
                "card_type": CardType.LAND,
                "subtype": "Plains",
                "text": "T: Add W.",
                "colors": [],
                "rarity": Rarity.COMMON
            },
            {
                "id": "swamp",
                "name": "Swamp",
                "mana_cost": "",
                "cmc": 0,
                "card_type": CardType.LAND,
                "subtype": "Swamp",
                "text": "T: Add B.",
                "colors": [],
                "rarity": Rarity.COMMON
            }
        ]
        
        # Fetch images from Scryfall API and add to cards
        sample_cards = []
        for card_data in sample_cards_data:
            image_url = await self.get_card_image_url(card_data["name"])
            card_data["image_url"] = image_url
            sample_cards.append(card_data)
            print(f"📷 {card_data['name']}: {'✅' if image_url else '❌'}")
        
        # Use upsert to update existing cards or insert new ones
        for card in sample_cards:
            await self.collection.replace_one(
                {"id": card["id"]}, 
                card, 
                upsert=True
            )
        print(f"Upserted {len(sample_cards)} sample cards with images")
