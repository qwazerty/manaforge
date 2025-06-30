"""
Refactored API routes for the ManaForge application.
Consolidated and optimized version with unified game action endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional, Any

from app.models.game import Card, Deck, DeckCard, GameState, GameAction
from app.services.card_service import CardService
from app.services.game_engine import SimpleGameEngine
from app.api.decorators import broadcast_game_update, action_registry
from app.api.action_handlers import *


router = APIRouter(prefix="/api/v1")

game_engine = SimpleGameEngine()


async def get_card_service() -> CardService:
    """Get card service dependency."""
    return CardService()


def get_game_engine() -> SimpleGameEngine:
    """Get game engine dependency."""
    return game_engine


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
    request: Optional[Dict[str, Any]] = None,
    game_id: Optional[str] = Query(None),
    card_service: CardService = Depends(get_card_service)
) -> GameState:
    """Create a new game with custom or sample decks."""
    if game_id is None:
        import uuid
        game_id = f"game-{str(uuid.uuid4())[:8]}"
    
    if request and "decklist_text" in request:
        deck1 = await card_service.parse_decklist(request.get("decklist_text", ""))
        game_state = game_engine.create_game_player1(game_id, deck1)
    else:
        try:
            deck1_cards = []
            for card_name, quantity in [
                ("Lightning Bolt", 4),
                ("Grizzly Bears", 4),
                ("Mountain", 12),
                ("Forest", 12)
            ]:
                card = await card_service.get_card_by_name(card_name)
                if card:
                    deck1_cards.append(DeckCard(card=card, quantity=quantity))
            
            deck2_cards = []
            for card_name, quantity in [
                ("Lightning Bolt", 4),
                ("Counterspell", 4),
                ("Serra Angel", 3),
                ("Island", 10),
                ("Mountain", 10),
                ("Plains", 9)
            ]:
                card = await card_service.get_card_by_name(card_name)
                if card:
                    deck2_cards.append(DeckCard(card=card, quantity=quantity))
            
            deck1 = Deck(name="Red-Green Deck", cards=deck1_cards)
            deck2 = Deck(name="Blue-White-Red Deck", cards=deck2_cards)
            
            game_state = game_engine.create_game(game_id, deck1, deck2)
            
        except Exception as e:
            print(f"Error creating sample decks: {e}")
            deck1 = Deck(name="Basic Red Deck", cards=[])
            deck2 = Deck(name="Basic Blue Deck", cards=[])
            game_state = game_engine.create_game(game_id, deck1, deck2)
    
    return game_state


@router.get("/games/list")
async def list_games() -> List[Dict[str, Any]]:
    """List all ongoing and waiting games."""
    print("Fetching games from game engine...")
    games_list = []
    for game_id, game_state in game_engine.games.items():
        print(f"Processing game {game_id} with state: {game_state}")
        players = game_state.players
        status = "waiting for players" if len(players) < 2 else "ongoing"
        games_list.append({
            "game_id": game_id,
            "status": status,
            "players": [player.id for player in players]
        })
    print(f"Returning games list: {games_list}")
    return games_list


@router.get("/games/{game_id}/state")
async def get_game_state(game_id: str) -> GameState:
    """Get current game state."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_engine.games[game_id]


@router.get("/games/{game_id}/ui-data")
async def get_game_ui_data(game_id: str) -> dict:
    """Get game data optimized for UI rendering."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = game_engine.games[game_id]
    
    def safe_model_dump(obj):
        """Safely convert object to dict, handling Pydantic models and dicts."""
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        elif isinstance(obj, dict):
            return obj
        else:
            return str(obj)
    
    return {
        'id': game_state.id,
        'turn': game_state.turn,
        'phase': game_state.phase.value,
        'active_player': game_state.active_player,
        'priority_player': game_state.priority_player,
        'players': [
            {
                'name': player.name,
                'life': player.life,
                'hand': [safe_model_dump(card) for card in player.hand],
                'battlefield': [
                    safe_model_dump(card) for card in player.battlefield
                ],
                'library': len(player.library),
                'graveyard': [
                    safe_model_dump(card) for card in player.graveyard
                ],
                'exile': [safe_model_dump(card) for card in player.exile]
            }
            for player in game_state.players
        ],
        'stack': [safe_model_dump(spell) for spell in game_state.stack]
    }


@router.post("/games/{game_id}/join")
async def join_game(
    game_id: str,
    request: dict,
    card_service: CardService = Depends(get_card_service)
) -> GameState:
    """Join an existing game as player 2 with a deck."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = game_engine.games[game_id]
    
    if len(current_state.players) >= 2:
        raise HTTPException(status_code=400, detail="Game is already full")
    
    decklist_text = request.get("decklist_text", "")
    if not decklist_text:
        raise HTTPException(status_code=400, detail="Decklist text is required")
    
    try:
        deck = await card_service.parse_decklist(decklist_text)
        
        game_state = game_engine.join_game(game_id, deck)
        
        await broadcast_game_update(game_id, game_state, {
            "action": "player_joined",
            "player": "2",
            "success": True
        })
        
        return game_state
        
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error joining game: {str(e)}"
        )


@router.post("/games/{game_id}/action")
async def perform_game_action(
    game_id: str,
    request: dict,
    engine: SimpleGameEngine = Depends(get_game_engine)
) -> dict:
    """
    Unified endpoint for all game actions.
    Uses action_type to dispatch to appropriate handler.
    """
    action_type = request.get("action_type")
    if not action_type:
        raise HTTPException(status_code=400, detail="action_type is required")
    
    handler_info = action_registry.get_handler(action_type)
    if not handler_info:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown action_type: {action_type}. "
                   f"Available: {action_registry.list_actions()}"
        )
    
    if game_id not in engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    current_state = engine.games[game_id]
    
    if "player_id" in request:
        player_id = request["player_id"]
    else:
        if action_type in ["pass_priority", "resolve_stack"]:
            player_id = f"player{current_state.priority_player}"
        else:
            player_id = str(current_state.active_player)
    
    try:
        handler = handler_info["handler"]
        action_data = await handler(game_id, request, current_state)
        
        final_action_type = action_data.get("action_type", action_type)
        
        action_params = {
            k: v for k, v in action_data.items()
            if k not in ["broadcast_data", "action_type"]
        }
        action = GameAction(
            player_id=player_id,
            action_type=final_action_type,
            **action_params
        )
        
        game_state = engine.process_action(game_id, action)
        
        broadcast_info = {
            "action": action_type,
            "player": player_id,
            "success": True
        }
        broadcast_info.update(action_data.get("broadcast_data", {}))
        
        await broadcast_game_update(game_id, game_state, broadcast_info)
        
        return {"success": True, "game_state": game_state}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/games/{game_id}/actions")
async def perform_action(game_id: str, action: GameAction) -> GameState:
    """Legacy endpoint - perform an action in the game."""
    try:
        game_state = game_engine.process_action(game_id, action)
        return game_state
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/games/{game_id}/pass-phase")
async def pass_phase_legacy(game_id: str, request: Optional[dict] = None) -> dict:
    """Legacy endpoint for pass-phase."""
    action_request = {"action_type": "pass_phase"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/shuffle-library")
async def shuffle_library_legacy(
    game_id: str, request: Optional[dict] = None
) -> dict:
    """Legacy endpoint for shuffle-library."""
    action_request = {"action_type": "shuffle_library"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/draw-card")
async def draw_card_legacy(game_id: str, request: Optional[dict] = None) -> dict:
    """Legacy endpoint for draw-card."""
    action_request = {"action_type": "draw_card"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/play-card")
async def play_card_legacy(game_id: str, request: dict) -> dict:
    """Legacy endpoint for play-card."""
    action_request = {"action_type": "play_card"}
    action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/tap-card")
async def tap_card_legacy(game_id: str, request: dict) -> dict:
    """Legacy endpoint for tap-card."""
    action_request = {"action_type": "tap_card"}
    action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/untap-all")
async def untap_all_legacy(game_id: str, request: Optional[dict] = None) -> dict:
    """Legacy endpoint for untap-all."""
    action_request = {"action_type": "untap_all"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/modify-life")
async def modify_life_legacy(game_id: str, request: dict) -> dict:
    """Legacy endpoint for modify-life."""
    action_request = {"action_type": "modify_life"}
    action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/resolve-stack")
async def resolve_stack_legacy(
    game_id: str, request: Optional[dict] = None
) -> dict:
    """Legacy endpoint for resolve-stack."""
    action_request = {"action_type": "resolve_stack"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/pass-priority")
async def pass_priority_legacy(
    game_id: str, request: Optional[dict] = None
) -> dict:
    """Legacy endpoint for pass-priority."""
    action_request = {"action_type": "pass_priority"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/target-card")
async def target_card_legacy(game_id: str, request: dict) -> dict:
    """Legacy endpoint for target-card."""
    action_request = {"action_type": "target_card"}
    action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


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
        raise HTTPException(
            status_code=400, detail=f"Error parsing decklist: {str(e)}"
        )


@router.get("/decks/{deck_id}")
async def get_deck(deck_id: str) -> Deck:
    """Get a deck by ID - Note: This endpoint is deprecated without database."""
    raise HTTPException(
        status_code=501, detail="Deck storage not implemented without database"
    )


@router.get("/actions")
async def list_available_actions() -> Dict[str, Any]:
    """List all available game actions."""
    return {
        "actions": action_registry.list_actions(),
        "description": "Use POST /games/{game_id}/action with action_type parameter"
    }
