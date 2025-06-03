"""
API routes for the ManaForge application.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.models.game import Card, Deck, GameState, GameAction
from app.services.card_service import CardService
from app.services.game_engine import SimpleGameEngine

router = APIRouter(prefix="/api/v1")

# Global game engine instance (in production, use proper dependency injection)
game_engine = SimpleGameEngine()


async def get_card_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> CardService:
    """Get card service dependency."""
    return CardService(db)


@router.get("/cards/search")
async def search_cards(
    q: str, 
    limit: int = 20,
    card_service: CardService = Depends(get_card_service)
) -> List[Card]:
    """Search for cards by name."""
    return await card_service.search_cards(q, limit)


@router.get("/cards/{card_id}")
async def get_card(
    card_id: str,
    card_service: CardService = Depends(get_card_service)
) -> Card:
    """Get a card by ID."""
    card = await card_service.get_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.post("/games")
async def create_game(game_id: str) -> GameState:
    """Create a new game with sample decks."""
    
    # Create simple test decks
    deck1_cards = [
        {"card": {"id": "lightning_bolt", "name": "Lightning Bolt", "mana_cost": "R", "cmc": 1, "card_type": "instant", "text": "Lightning Bolt deals 3 damage to any target.", "colors": ["R"], "rarity": "common"}, "quantity": 4},
        {"card": {"id": "grizzly_bears", "name": "Grizzly Bears", "mana_cost": "1G", "cmc": 2, "card_type": "creature", "subtype": "Bear", "power": 2, "toughness": 2, "colors": ["G"], "rarity": "common"}, "quantity": 4},
        {"card": {"id": "mountain", "name": "Mountain", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Mountain", "text": "T: Add R.", "colors": [], "rarity": "common"}, "quantity": 12},
        {"card": {"id": "forest", "name": "Forest", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Forest", "text": "T: Add G.", "colors": [], "rarity": "common"}, "quantity": 12}
    ]
    
    deck2_cards = [
        {"card": {"id": "counterspell", "name": "Counterspell", "mana_cost": "UU", "cmc": 2, "card_type": "instant", "text": "Counter target spell.", "colors": ["U"], "rarity": "common"}, "quantity": 4},
        {"card": {"id": "serra_angel", "name": "Serra Angel", "mana_cost": "3WW", "cmc": 5, "card_type": "creature", "subtype": "Angel", "text": "Flying, vigilance", "power": 4, "toughness": 4, "colors": ["W"], "rarity": "uncommon"}, "quantity": 4},
        {"card": {"id": "island", "name": "Island", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Island", "text": "T: Add U.", "colors": [], "rarity": "common"}, "quantity": 12},
        {"card": {"id": "plains", "name": "Plains", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Plains", "text": "T: Add W.", "colors": [], "rarity": "common"}, "quantity": 12}
    ]
    
    deck1 = Deck(name="Red-Green Deck", cards=deck1_cards)
    deck2 = Deck(name="Blue-White Deck", cards=deck2_cards)
    
    game_state = game_engine.create_game(game_id, deck1, deck2)
    return game_state


@router.get("/games/{game_id}")
async def get_game(game_id: str) -> GameState:
    """Get current game state."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_engine.games[game_id]


@router.post("/games/{game_id}/actions")
async def perform_action(game_id: str, action: GameAction) -> GameState:
    """Perform an action in the game."""
    try:
        game_state = game_engine.process_action(game_id, action)
        return game_state
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
