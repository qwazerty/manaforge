"""
API routes for the ManaForge application.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
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


# Helper function to broadcast game updates via WebSocket
async def broadcast_game_update(game_id: str, game_state: GameState, action_info: dict = None):
    """Broadcast game state update to all connected clients."""
    try:
        from app.api.websocket import manager
        
        message = {
            "type": "game_state_update",
            "game_state": game_state.model_dump(),
            "timestamp": game_state.turn if hasattr(game_state, 'turn') else None
        }
        
        # Add action information if provided
        if action_info:
            message["action_result"] = action_info
        
        await manager.broadcast_to_game(game_id, message)
        print(f"Broadcasted game state update for game {game_id}")
        
    except Exception as e:
        print(f"Error broadcasting game update: {e}")


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
async def create_game(
    game_id: Optional[str] = Query(None),
    card_service: CardService = Depends(get_card_service)
) -> GameState:
    """Create a new game with sample decks."""
    # Generate a default game_id if not provided
    if game_id is None:
        import uuid
        game_id = f"game-{str(uuid.uuid4())[:8]}"
    
    # Get cards from database with images
    lightning_bolt = await card_service.get_card_by_id("lightning_bolt")
    grizzly_bears = await card_service.get_card_by_id("grizzly_bears")
    mountain = await card_service.get_card_by_id("mountain")
    forest = await card_service.get_card_by_id("forest")
    counterspell = await card_service.get_card_by_id("counterspell")
    serra_angel = await card_service.get_card_by_id("serra_angel")
    island = await card_service.get_card_by_id("island")
    plains = await card_service.get_card_by_id("plains")
    
    # Create test decks with database cards
    deck1_cards = [
        {"card": lightning_bolt.model_dump() if lightning_bolt else {"id": "lightning_bolt", "name": "Lightning Bolt", "mana_cost": "R", "cmc": 1, "card_type": "instant", "text": "Lightning Bolt deals 3 damage to any target.", "colors": ["R"], "rarity": "common"}, "quantity": 4},
        {"card": grizzly_bears.model_dump() if grizzly_bears else {"id": "grizzly_bears", "name": "Grizzly Bears", "mana_cost": "1G", "cmc": 2, "card_type": "creature", "subtype": "Bear", "power": 2, "toughness": 2, "colors": ["G"], "rarity": "common"}, "quantity": 4},
        {"card": mountain.model_dump() if mountain else {"id": "mountain", "name": "Mountain", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Mountain", "text": "T: Add R.", "colors": [], "rarity": "common"}, "quantity": 12},
        {"card": forest.model_dump() if forest else {"id": "forest", "name": "Forest", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Forest", "text": "T: Add G.", "colors": [], "rarity": "common"}, "quantity": 12}
    ]
    
    deck2_cards = [
        {"card": counterspell.model_dump() if counterspell else {"id": "counterspell", "name": "Counterspell", "mana_cost": "UU", "cmc": 2, "card_type": "instant", "text": "Counter target spell.", "colors": ["U"], "rarity": "common"}, "quantity": 4},
        {"card": serra_angel.model_dump() if serra_angel else {"id": "serra_angel", "name": "Serra Angel", "mana_cost": "3WW", "cmc": 5, "card_type": "creature", "subtype": "Angel", "text": "Flying, vigilance", "power": 4, "toughness": 4, "colors": ["W"], "rarity": "uncommon"}, "quantity": 4},
        {"card": island.model_dump() if island else {"id": "island", "name": "Island", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Island", "text": "T: Add U.", "colors": [], "rarity": "common"}, "quantity": 12},
        {"card": plains.model_dump() if plains else {"id": "plains", "name": "Plains", "mana_cost": "", "cmc": 0, "card_type": "land", "subtype": "Plains", "text": "T: Add W.", "colors": [], "rarity": "common"}, "quantity": 12}
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


@router.get("/games/{game_id}/state")
async def get_game_state(game_id: str) -> GameState:
    """Get current game state (alias for auto-refresh)."""
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


@router.post("/games/{game_id}/pass-phase")
async def pass_phase(game_id: str, request: Optional[dict] = None) -> dict:
    """Pass the current phase."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = game_engine.games[game_id]
    
    # Get player_id from request body if provided, otherwise use current player
    if request and "player_id" in request:
        player_id = request["player_id"]
    else:
        # Use the active_player index from GameState
        player_id = str(current_state.active_player)
    
    action = GameAction(
        player_id=player_id,
        action_type="pass_phase"
    )
    try:
        game_state = game_engine.process_action(game_id, action)
        
        # Broadcast update via WebSocket with action info
        await broadcast_game_update(game_id, game_state, {
            "action": "pass_phase",
            "player": player_id,
            "success": True
        })
        
        return {"success": True, "game_state": game_state}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/games/{game_id}/draw-card")
async def draw_card(game_id: str, request: Optional[dict] = None) -> dict:
    """Draw a card for the current player."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = game_engine.games[game_id]
    
    # Get player_id from request body if provided, otherwise use current player
    if request and "player_id" in request:
        player_id = request["player_id"]
    else:
        # Use the active_player index from GameState
        player_id = str(current_state.active_player)
    
    action = GameAction(
        player_id=player_id,
        action_type="draw_card"
    )
    try:
        game_state = game_engine.process_action(game_id, action)
        
        # Broadcast update via WebSocket with action info
        await broadcast_game_update(game_id, game_state, {
            "action": "draw_card",
            "player": player_id,
            "success": True
        })
        
        return {"success": True, "game_state": game_state}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/games/{game_id}/play-card")
async def play_card(game_id: str, request: dict) -> dict:
    """Play a card for the current player."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = game_engine.games[game_id]
    
    # Get player_id from request body if provided, otherwise use current player
    if "player_id" in request:
        player_id = request["player_id"]
    else:
        # Use the active_player index from GameState
        player_id = str(current_state.active_player)
    
    card_name = request.get("card_name")
    card_id = request.get("card_id")
    
    action = GameAction(
        player_id=player_id,
        action_type="play_card",
        card_id=card_id or card_name,
        additional_data={"card_name": card_name} if card_name else {}
    )
    try:
        game_state = game_engine.process_action(game_id, action)
        
        # Broadcast update via WebSocket with action info
        await broadcast_game_update(game_id, game_state, {
            "action": "play_card",
            "player": player_id,
            "card": card_name or card_id,
            "success": True
        })
        
        return {"success": True, "game_state": game_state}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"success": False, "error": str(e)}
