"""
API routes for the ManaForge application.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.models.game import Card, Deck, DeckCard, GameState, GameAction
from app.services.card_service import CardService
from app.services.game_engine import SimpleGameEngine

router = APIRouter(prefix="/api/v1")

# Global game engine instance (in production, use proper dependency injection)
game_engine = SimpleGameEngine()


async def get_card_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> CardService:
    """Get card service dependency."""
    return CardService(db)


# Helper function to broadcast game updates via WebSocket
async def broadcast_game_update(game_id: str, game_state: GameState, action_info: Optional[dict] = None):
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
    request: Optional[dict] = None,
    game_id: Optional[str] = Query(None),
    card_service: CardService = Depends(get_card_service)
) -> GameState:
    """Create a new game with custom or sample decks."""
    # Generate a default game_id if not provided
    if game_id is None:
        import uuid
        game_id = f"game-{str(uuid.uuid4())[:8]}"
    
    # Check if custom deck is provided
    if request and "decklist_text" in request:
        # Parse custom deck for player 1
        deck1 = await card_service.parse_decklist(request["decklist_text"])
        # Create game with just player 1, waiting for player 2
        game_state = game_engine.create_game_player1(game_id, deck1)
    else:
        # Create test decks with database cards (legacy support)
        deck1_deck_cards = []
        for card, quantity in [
            (await card_service.get_card_by_id("lightning_bolt"), 4),
            (await card_service.get_card_by_id("grizzly_bears"), 4),
            (await card_service.get_card_by_id("mountain"), 12),
            (await card_service.get_card_by_id("forest"), 12)
        ]:
            if card:
                deck1_deck_cards.append(DeckCard(card=card, quantity=quantity))
        
        deck2_deck_cards = []
        for card, quantity in [
            (await card_service.get_card_by_id("arena_of_glory"), 1),
            (await card_service.get_card_by_id("arid_mesa"), 4),
            (await card_service.get_card_by_id("blood_crypt"), 1),
            (await card_service.get_card_by_id("consign_to_memory"), 1),
            (await card_service.get_card_by_id("flooded_strand"), 4),
            (await card_service.get_card_by_id("leyline_binding"), 4),
            (await card_service.get_card_by_id("leyline_of_the_guildpact"), 4),
            (await card_service.get_card_by_id("lightning_bolt"), 4),
            (await card_service.get_card_by_id("mountain"), 1),
            (await card_service.get_card_by_id("phlage_titan_of_fires_fury"), 3),
            (await card_service.get_card_by_id("plains"), 1),
            (await card_service.get_card_by_id("psychic_frog"), 3),
            (await card_service.get_card_by_id("ragavan_nimble_pilferer"), 3),
            (await card_service.get_card_by_id("raucous_theater"), 1),
            (await card_service.get_card_by_id("sacred_foundry"), 1),
            (await card_service.get_card_by_id("scion_of_draco"), 4),
            (await card_service.get_card_by_id("sparas_headquarters"), 1),
            (await card_service.get_card_by_id("steam_vents"), 1),
            (await card_service.get_card_by_id("stubborn_denial"), 3),
            (await card_service.get_card_by_id("temple_garden"), 1),
            (await card_service.get_card_by_id("territorial_kavu"), 4),
            (await card_service.get_card_by_id("tribal_flames"), 3),
            (await card_service.get_card_by_id("winternight_stories"), 2),
            (await card_service.get_card_by_id("wooded_foothills"), 4),
            (await card_service.get_card_by_id("xanders_lounge"), 1)
        ]:
            if card:
                deck2_deck_cards.append(DeckCard(card=card, quantity=quantity))
        
        deck1 = Deck(name="Red-Green Deck", cards=deck1_deck_cards)
        deck2 = Deck(name="Blue-White Deck", cards=deck2_deck_cards)
        
        # Create full game with both players (legacy mode)
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


@router.post("/decks/parse")
async def parse_decklist(
    request: dict,
    card_service: CardService = Depends(get_card_service)
) -> Deck:
    """Parse a decklist from text format and create a Deck object."""
    decklist_text = request.get("decklist_text", "")
    if not decklist_text:
        raise HTTPException(status_code=400, detail="Decklist text is required")
    
    try:
        deck = await card_service.parse_decklist(decklist_text)
        return deck
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing decklist: {str(e)}")


@router.get("/decks/{deck_id}")
async def get_deck(
    deck_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Deck:
    """Get a deck by ID."""
    deck_data = await db.decks.find_one({"id": deck_id})
    if not deck_data:
        raise HTTPException(status_code=404, detail="Deck not found")
    return Deck(**deck_data)


@router.post("/games/{game_id}/join")
async def join_game(
    game_id: str, 
    request: dict,
    card_service: CardService = Depends(get_card_service)
) -> GameState:
    """Join an existing game as player 2 with a deck."""
    # Check if game exists
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = game_engine.games[game_id]
    
    # Check if game is already full
    if len(current_state.players) >= 2:
        raise HTTPException(status_code=400, detail="Game is already full")
    
    # Parse the deck from request
    decklist_text = request.get("decklist_text", "")
    if not decklist_text:
        raise HTTPException(status_code=400, detail="Decklist text is required")
    
    try:
        deck = await card_service.parse_decklist(decklist_text)
        
        # Join the game with the parsed deck as player 2
        game_state = game_engine.join_game(game_id, deck)
        
        # Broadcast update to notify all connected clients
        await broadcast_game_update(game_id, game_state, {
            "action": "player_joined",
            "player": "2",
            "success": True
        })
        
        return game_state
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error joining game: {str(e)}")
