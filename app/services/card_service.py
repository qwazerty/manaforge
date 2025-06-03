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
    
    async def initialize_sample_data(self):
        """Initialize database with sample cards for POC."""
        
        # Check if cards already exist
        count = await self.collection.count_documents({})
        if count > 0:
            return
        
        sample_cards = [
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
        
        await self.collection.insert_many(sample_cards)
        print(f"Inserted {len(sample_cards)} sample cards")
