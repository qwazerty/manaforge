"""
Refactored API routes for the ManaForge application.
Consolidated and optimized version with unified game action endpoint.
"""

import uuid
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional, Any

from app.models.game import (
    Card, Deck, DeckCard, GameState, GameAction,
    GameSetupStatus, PlayerDeckStatus, GameFormat, PhaseMode
)
from app.services.card_service import CardService
from app.services.game_engine import SimpleGameEngine
from app.api.decorators import broadcast_game_update, action_registry
from app.api.action_handlers import *
from app.services.format_stats_service import get_cards_for_format


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
    type: Optional[str] = None,
    card_service: CardService = Depends(get_card_service)
) -> List[Card]:
    """Search for cards by name with optional type filtering (e.g., type=token, type=creature, etc.)."""
    return await card_service.search_cards(q, limit, type)


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
    game_id: Optional[str] = Query(None)
) -> GameSetupStatus:
    """
    Create a new game setup (without decks yet).
    Players will submit their decks in a separate step.
    """
    if game_id is None:
        game_id = f"game-{str(uuid.uuid4())[:8]}"
    
    request_payload = request or {}

    raw_format = request_payload.get("game_format")
    raw_phase_mode = request_payload.get("phase_mode")

    if raw_format is None:
        game_format = GameFormat.STANDARD
    else:
        normalized_format = str(raw_format).strip().lower().replace(" ", "_")
        try:
            game_format = GameFormat(normalized_format)
        except ValueError:
            allowed_formats = ", ".join(fmt.value for fmt in GameFormat)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid game_format '{raw_format}'. Allowed values: {allowed_formats}"
            )

    if raw_phase_mode is None:
        phase_mode = PhaseMode.CASUAL
    else:
        normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
        try:
            phase_mode = PhaseMode(normalized_phase)
        except ValueError:
            allowed_modes = ", ".join(mode.value for mode in PhaseMode)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}"
            )

    setup_status = game_engine.create_game_setup(
        game_id=game_id,
        game_format=game_format,
        phase_mode=phase_mode
    )
    
    return setup_status

@router.post("/games/import-modern-example")
async def create_modern_example_game(
    request: Optional[Dict[str, Any]] = None,
    game_id: Optional[str] = Query(None),
    card_service: CardService = Depends(get_card_service)
) -> Dict[str, Any]:
    """
    Create a Modern game preloaded with the top paper decks from MTGGoldfish.
    """
    payload = request or {}
    raw_game_id = (
        payload.get("game_id")
        or payload.get("gameId")
        or game_id
        or f"modern-demo-{uuid.uuid4().hex[:8]}"
    )
    game_id_clean = str(raw_game_id).strip()
    if not game_id_clean:
        raise HTTPException(status_code=400, detail="game_id cannot be empty.")

    raw_phase_mode = payload.get("phase_mode") or payload.get("phaseMode") or PhaseMode.CASUAL.value
    normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
    try:
        phase_mode = PhaseMode(normalized_phase)
    except ValueError:
        allowed_modes = ", ".join(mode.value for mode in PhaseMode)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}"
        )

    existing_setup = game_engine.get_game_setup_status(game_id_clean)
    if existing_setup:
        submitted_any = any(
            status.submitted for status in existing_setup.player_status.values()
        )
        if existing_setup.ready or submitted_any:
            raise HTTPException(
                status_code=400,
                detail="This battlefield already has deck submissions."
            )
        if existing_setup.game_format != GameFormat.MODERN:
            raise HTTPException(
                status_code=400,
                detail="The existing battlefield uses another format. Please choose a new game name."
            )
        phase_mode = existing_setup.phase_mode
        setup_status = existing_setup
    else:
        setup_status = game_engine.create_game_setup(
            game_id=game_id_clean,
            game_format=GameFormat.MODERN,
            phase_mode=phase_mode
        )

    try:
        deck_sources = await card_service.fetch_mtggoldfish_metagame_deck_urls(
            format_slug="modern",
            limit=2,
            platform="paper"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if len(deck_sources) < 2:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate two Modern decks on MTGGoldfish."
        )

    imported_decks: List[Dict[str, Any]] = []

    for idx, deck_source in enumerate(deck_sources[:2], start=1):
        player_id = f"player{idx}"
        try:
            import_result = await card_service.import_deck_from_url(deck_source["deck_url"])
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to import deck {deck_source['deck_url']}: {exc}"
            )

        deck = import_result["deck"]
        player_alias = import_result.get("deck_name") or deck.name

        setup_status = game_engine.claim_player_seat(
            game_id=game_id_clean,
            player_id=player_id,
            player_name=player_alias
        )
        setup_status = game_engine.submit_player_deck(
            game_id=game_id_clean,
            player_id=player_id,
            deck=deck
        )

        imported_decks.append(
            {
                "player_id": player_id,
                "deck_name": deck.name,
                "deck_url": deck_source["deck_url"]
            }
        )

    encoded_id = quote_plus(game_id_clean)
    game_interface_url = f"/game-interface/{encoded_id}"
    game_room_url = f"/game-room/{encoded_id}"
    share_links = {
        "player1": f"{game_room_url}?player=player1",
        "player2": f"{game_room_url}?player=player2",
        "spectator": f"{game_room_url}?player=spectator"
    }

    return {
        "game_id": game_id_clean,
        "setup": setup_status,
        "decks": imported_decks,
        "game_interface_url": game_interface_url,
        "game_room_url": game_room_url,
        "share_links": share_links,
        "metagame_source": deck_sources[0].get("metagame_url") if deck_sources else None
    }


@router.get("/games/list")
async def list_games() -> List[Dict[str, Any]]:
    """List all game rooms and active games with their current status."""
    games_list: List[Dict[str, Any]] = []
    processed_games = set()

    for game_id, setup in game_engine.game_setups.items():
        player_status_dump = {
            player_id: status.model_dump()
            for player_id, status in setup.player_status.items()
        }
        submitted_count = sum(1 for status in player_status_dump.values() if status.get("submitted"))
        validated_count = sum(1 for status in player_status_dump.values() if status.get("validated"))
        seat_claimed_count = sum(1 for status in player_status_dump.values() if status.get("seat_claimed"))

        entry: Dict[str, Any] = {
            "game_id": game_id,
            "status": setup.status,
            "ready": setup.ready,
            "game_format": setup.game_format.value if hasattr(setup.game_format, "value") else str(setup.game_format),
            "phase_mode": setup.phase_mode.value if hasattr(setup.phase_mode, "value") else str(setup.phase_mode),
            "submitted_count": submitted_count,
            "validated_count": validated_count,
            "seat_claimed_count": seat_claimed_count,
            "player_status": player_status_dump,
            "created_at": setup.created_at.isoformat(),
            "players": [
                player_id
                for player_id, status in player_status_dump.items()
                if status.get("submitted")
            ],
            "max_players": 2
        }

        if setup.ready and game_id in game_engine.games:
            game_state = game_engine.games[game_id]
            entry["status"] = "ongoing"
            entry["players"] = [player.id for player in game_state.players]
            entry["active_player"] = game_state.active_player
            entry["turn"] = game_state.turn
            entry["created_at"] = game_state.created_at.isoformat()
            processed_games.add(game_id)

        games_list.append(entry)

    for game_id, game_state in game_engine.games.items():
        if game_id in processed_games:
            continue
        games_list.append({
            "game_id": game_id,
            "status": "ongoing",
            "ready": True,
            "game_format": getattr(game_state.game_format, "value", str(game_state.game_format)),
            "phase_mode": getattr(game_state.phase_mode, "value", str(game_state.phase_mode)),
            "submitted_count": len(game_state.players),
            "validated_count": len(game_state.players),
            "seat_claimed_count": len(game_state.players),
            "player_status": {},
            "players": [player.id for player in game_state.players],
            "active_player": game_state.active_player,
            "turn": game_state.turn,
            "max_players": len(game_state.players),
            "created_at": game_state.created_at.isoformat()
        })

    return games_list


@router.get("/games/{game_id}/setup")
async def get_game_setup_status(game_id: str) -> GameSetupStatus:
    """Get game setup status (for deck import phase)."""
    setup = game_engine.get_game_setup_status(game_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Game setup not found")
    return setup


@router.get("/formats/{format_code}/cards")
async def list_format_cards(
    format_code: str,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    availability: Optional[str] = None,
) -> Dict[str, Any]:
    """Return paginated cards for the requested format."""
    return get_cards_for_format(
        format_code=format_code,
        page=page,
        page_size=page_size,
        search=search,
        availability=availability,
    )

@router.post("/games/{game_id}/submit-deck")
async def submit_player_deck(
    game_id: str,
    request: dict,
    card_service: CardService = Depends(get_card_service)
) -> GameSetupStatus:
    """
    Submit a deck for a specific player in the game setup phase.
    Once both players have submitted valid decks, the game will initialize.
    """
    player_id = request.get("player_id")
    decklist_text = str(request.get("decklist_text", "") or "").strip()
    decklist_url = str(
        request.get("decklist_url")
        or request.get("deck_url")
        or ""
    ).strip()

    if not player_id:
        raise HTTPException(status_code=400, detail="player_id is required")

    deck = None

    if decklist_url and not decklist_text:
        try:
            import_result = await card_service.import_deck_from_url(decklist_url)
            deck = import_result["deck"]
            decklist_text = import_result["deck_text"]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Error importing deck from URL: {exc}"
            )

    if not decklist_text and deck is None:
        raise HTTPException(status_code=400, detail="decklist_text is required")
    
    try:
        if deck is None:
            deck = await card_service.parse_decklist(decklist_text)
        
        setup_status = game_engine.submit_player_deck(
            game_id=game_id,
            player_id=player_id,
            deck=deck
        )
        
        return setup_status
        
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error submitting deck: {str(e)}"
        )

@router.post("/games/{game_id}/claim-seat")
async def claim_seat(game_id: str, request: dict) -> GameSetupStatus:
    """Mark a seat as occupied when a player joins the room."""
    player_id = request.get("player_id")
    player_name = request.get("player_name")
    if player_id not in {"player1", "player2"}:
        raise HTTPException(status_code=400, detail="player_id must be player1 or player2")

    try:
        setup_status = game_engine.claim_player_seat(
            game_id=game_id,
            player_id=player_id,
            player_name=player_name
        )
        return setup_status
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/games/{game_id}/update-settings")
async def update_game_settings(game_id: str, request: dict) -> GameSetupStatus:
    """Update game settings (format, phase mode) before the game starts."""
    raw_format = request.get("game_format")
    raw_phase_mode = request.get("phase_mode")
    
    game_format = None
    phase_mode = None
    
    if raw_format is not None:
        normalized_format = str(raw_format).strip().lower().replace(" ", "_")
        try:
            game_format = GameFormat(normalized_format)
        except ValueError:
            allowed_formats = ", ".join(fmt.value for fmt in GameFormat)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid game_format '{raw_format}'. Allowed values: {allowed_formats}"
            )
    
    if raw_phase_mode is not None:
        normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
        try:
            phase_mode = PhaseMode(normalized_phase)
        except ValueError:
            allowed_modes = ", ".join(mode.value for mode in PhaseMode)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}"
            )
    
    try:
        setup_status = game_engine.update_game_settings(
            game_id=game_id,
            game_format=game_format,
            phase_mode=phase_mode
        )
        return setup_status
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/games/{game_id}/state")
async def get_game_state(game_id: str) -> Dict[str, Any]:
    """Get current game state (only available after setup is complete)."""
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_engine.games[game_id].model_dump(mode="json")


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
        'phase_mode': game_state.phase_mode.value,
        'game_format': getattr(game_state.game_format, 'value', str(game_state.game_format)),
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
                'library': [
                    safe_model_dump(card) for card in player.library
                ],
                'graveyard': [
                    safe_model_dump(card) for card in player.graveyard
                ],
                'exile': [safe_model_dump(card) for card in player.exile],
                'reveal_zone': [
                    safe_model_dump(card) for card in getattr(player, 'reveal_zone', [])
                ],
                'commander_zone': [
                    safe_model_dump(card) for card in getattr(player, 'commander_zone', [])
                ],
                'commander_tax': getattr(player, 'commander_tax', 0)
            }
            for player in game_state.players
        ],
        'stack': [safe_model_dump(spell) for spell in game_state.stack],
        'action_history': [
            safe_model_dump(entry)
            for entry in getattr(game_state, 'action_history', [])
        ],
        'chat_log': [
            safe_model_dump(entry)
            for entry in getattr(game_state, 'chat_log', [])
        ]
    }




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
            priority_index = current_state.priority_player
            player_id = current_state.players[priority_index].id if 0 <= priority_index < len(current_state.players) else f"player{priority_index + 1}"
        else:
            active_index = current_state.active_player
            player_id = current_state.players[active_index].id if 0 <= active_index < len(current_state.players) else f"player{active_index + 1}"
    
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
        
        game_state = await engine.process_action(game_id, action)
        
        broadcast_info = {
            "action": action_type,
            "player": player_id,
            "success": True
        }
        broadcast_info.update(action_data.get("broadcast_data", {}))
        
        await broadcast_game_update(game_id, game_state, broadcast_info)
        
        return {
            "success": True,
            "game_state": game_state.model_dump(mode="json")
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/games/{game_id}/actions")
async def perform_action(game_id: str, action: GameAction) -> Dict[str, Any]:
    """Legacy endpoint - perform an action in the game."""
    try:
        game_state = await game_engine.process_action(game_id, action)
        return game_state.model_dump(mode="json")
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
    decklist_text = str(request.get("decklist_text", "") or "").strip()
    decklist_url = str(
        request.get("decklist_url")
        or request.get("deck_url")
        or ""
    ).strip()

    if decklist_url and not decklist_text:
        try:
            result = await card_service.import_deck_from_url(decklist_url)
            return result["deck"]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Error importing deck from URL: {exc}"
            )

    if not decklist_text:
        raise HTTPException(status_code=400, detail="Decklist text is required")
    
    try:
        return await card_service.parse_decklist(decklist_text)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error parsing decklist: {str(e)}"
        )


@router.post("/decks/import-url")
async def import_deck_from_url(
    request: dict,
    card_service: CardService = Depends(get_card_service)
) -> Dict[str, Any]:
    """Import a deck from a supported provider URL."""
    deck_url = str(
        request.get("deck_url")
        or request.get("decklist_url")
        or request.get("source_url")
        or ""
    ).strip()

    if not deck_url:
        raise HTTPException(status_code=400, detail="deck_url is required")

    try:
        result = await card_service.import_deck_from_url(deck_url)
        deck = result["deck"]
        return {
            "deck": deck.model_dump(mode="json"),
            "deck_text": result["deck_text"],
            "deck_name": deck.name
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Error importing deck from URL: {exc}"
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
