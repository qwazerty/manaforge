"""
Service for managing draft-related logic, such as sets and boosters.
"""
import aiohttp
import random
from typing import List, Dict, Any, Optional

from app.models.game import Card, Rarity
from app.services.card_service import CardService

class DraftService:
    """Service for managing draft-related logic."""

    def __init__(self, card_service: CardService):
        self.card_service = card_service

    async def search_sets(self, query: str) -> List[Dict[str, Any]]:
        """Search for MTG sets using the Scryfall API."""
        if not query:
            return []
        
        url = f"https://api.scryfall.com/sets?q={query}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return [
                        {
                            "code": s.get("code"),
                            "name": s.get("name"),
                            "icon_svg_uri": s.get("icon_svg_uri"),
                            "released_at": s.get("released_at"),
                        }
                        for s in data.get("data", [])
                        if s.get("set_type") in ["core", "expansion", "masters"]
                    ]
        return []

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
        search_query = f"e:{set_code} r:{rarity}"
        url = f"https://api.scryfall.com/cards/search?q={search_query}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                all_cards_data = data.get("data", [])
                
                if not all_cards_data:
                    return []

                # Scryfall API returns up to 175 cards per page. For simplicity, we'll sample from the first page.
                # For a full implementation, we would need to handle pagination.
                
                sampled_cards_data = random.sample(all_cards_data, min(count, len(all_cards_data)))
                
                cards = []
                for card_data in sampled_cards_data:
                    parsed_card = self.card_service._parse_scryfall_card(card_data)
                    if parsed_card:
                        cards.append(Card(**parsed_card))
                return cards
