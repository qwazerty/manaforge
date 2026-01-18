"""
Refactored API routes for the ManaForge application.
Consolidated and optimized version with unified game action endpoint.
"""

import uuid
import time
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional, Any

from app.backend.models.game import (
    Card,
    Deck,
    GameAction,
    GameSetupStatus,
    GameFormat,
    PhaseMode,
)
from app.backend.services.card_service import CardService
from app.backend.services.game_engine import SimpleGameEngine
from app.backend.api.decorators import broadcast_game_update, action_registry

# fmt: off
from app.backend.api import action_handlers  # noqa: F401 - handlers are registered via decorators
# fmt: on

from app.backend.services.format_stats_service import get_cards_for_format
from app.backend.services.pricing_service import get_memory_usage, lookup_prices


router = APIRouter(prefix="/api/v1")

game_engine = SimpleGameEngine()

# Singleton CardService instance - stateless, no need to create per request
_card_service_instance: Optional[CardService] = None


def get_card_service() -> CardService:
    """Get card service singleton dependency."""
    global _card_service_instance
    if _card_service_instance is None:
        _card_service_instance = CardService()
    return _card_service_instance


def get_game_engine() -> SimpleGameEngine:
    """Get game engine dependency."""
    return game_engine


@router.get("/cards/search")
async def search_cards(
    q: str,
    limit: int = 20,
    type: Optional[str] = None,
    tokens_only: bool = False,
    exact: bool = False,
    set: Optional[str] = None,
    card_service: CardService = Depends(get_card_service),
) -> List[Card]:
    """Search for cards by name using the local oracle dump with optional filtering."""
    local_cards = card_service.search_local_cards(
        query=q, limit=limit, tokens_only=tokens_only, exact=exact, set_code=set
    )

    normalized_results: List[Card] = []
    for raw_card in local_cards:
        card_data = card_service._parse_scryfall_card(raw_card)
        card_data.setdefault(
            "unique_id", f"{card_data.get('id', 'card')}_{uuid.uuid4().hex[:8]}"
        )
        normalized_results.append(Card(**card_data))

    return normalized_results


@router.get("/cards/{card_id}")
async def get_card(
    card_id: str, card_service: CardService = Depends(get_card_service)
) -> Card:
    """Get a card by ID."""
    card = await card_service.get_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.post("/games")
async def create_game(
    request: Optional[Dict[str, Any]] = None, game_id: Optional[str] = Query(None)
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
    raw_max_players = request_payload.get("max_players")

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
                detail=f"Invalid game_format '{raw_format}'. Allowed values: {allowed_formats}",
            )

    if raw_phase_mode is None:
        phase_mode = PhaseMode.STRICT
    else:
        normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
        try:
            phase_mode = PhaseMode(normalized_phase)
        except ValueError:
            allowed_modes = ", ".join(mode.value for mode in PhaseMode)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}",
            )

    max_players = None
    if raw_max_players is not None:
        try:
            max_players = int(raw_max_players)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400, detail="max_players must be an integer"
            )

    setup_status = game_engine.create_game_setup(
        game_id=game_id,
        game_format=game_format,
        phase_mode=phase_mode,
        max_players=max_players,
    )

    return setup_status


@router.post("/games/import-modern-example")
async def create_modern_example_game(
    request: Optional[Dict[str, Any]] = None,
    game_id: Optional[str] = Query(None),
    card_service: CardService = Depends(get_card_service),
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

    raw_phase_mode = (
        payload.get("phase_mode") or payload.get("phaseMode") or PhaseMode.STRICT.value
    )
    normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
    try:
        phase_mode = PhaseMode(normalized_phase)
    except ValueError:
        allowed_modes = ", ".join(mode.value for mode in PhaseMode)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}",
        )

    existing_setup = game_engine.get_game_setup_status(game_id_clean)
    if existing_setup:
        submitted_any = any(
            status.submitted for status in existing_setup.player_status.values()
        )
        if existing_setup.ready or submitted_any:
            raise HTTPException(
                status_code=400, detail="This battlefield already has deck submissions."
            )
        # Update the format to Modern if it's different and no decks have been submitted
        if existing_setup.game_format != GameFormat.MODERN:
            setup_status = game_engine.update_game_settings(
                game_id=game_id_clean,
                game_format=GameFormat.MODERN,
                phase_mode=phase_mode,
            )
        else:
            phase_mode = existing_setup.phase_mode
            setup_status = existing_setup
    else:
        setup_status = game_engine.create_game_setup(
            game_id=game_id_clean, game_format=GameFormat.MODERN, phase_mode=phase_mode
        )

    try:
        deck_sources = await card_service.fetch_mtggoldfish_metagame_deck_urls(
            format_slug="modern", limit=2, platform="paper"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if len(deck_sources) < 2:
        raise HTTPException(
            status_code=400, detail="Unable to locate two Modern decks on MTGGoldfish."
        )

    imported_decks: List[Dict[str, Any]] = []

    for idx, deck_source in enumerate(deck_sources[:2], start=1):
        player_id = f"player{idx}"
        try:
            import_result = await card_service.import_deck_from_url(
                deck_source["deck_url"]
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to import deck {deck_source['deck_url']}: {exc}",
            )

        deck = import_result["deck"]
        player_alias = import_result.get("deck_name") or deck.name

        setup_status = game_engine.claim_player_seat(
            game_id=game_id_clean, player_id=player_id, player_name=player_alias
        )
        setup_status = game_engine.submit_player_deck(
            game_id=game_id_clean, player_id=player_id, deck=deck
        )

        imported_decks.append(
            {
                "player_id": player_id,
                "deck_name": deck.name,
                "deck_url": deck_source["deck_url"],
            }
        )

    encoded_id = quote_plus(game_id_clean)
    game_interface_url = f"/game-interface/{encoded_id}"
    game_room_url = f"/game-room/{encoded_id}"
    share_links = {
        f"player{index + 1}": f"{game_room_url}?player=player{index + 1}"
        for index in range(setup_status.max_players)
    }
    share_links["spectator"] = f"{game_room_url}?player=spectator"

    return {
        "game_id": game_id_clean,
        "setup": setup_status,
        "decks": imported_decks,
        "game_interface_url": game_interface_url,
        "game_room_url": game_room_url,
        "share_links": share_links,
        "metagame_source": (
            deck_sources[0].get("metagame_url") if deck_sources else None
        ),
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
        submitted_count = sum(
            1 for status in player_status_dump.values() if status.get("submitted")
        )
        validated_count = sum(
            1 for status in player_status_dump.values() if status.get("validated")
        )
        seat_claimed_count = sum(
            1 for status in player_status_dump.values() if status.get("seat_claimed")
        )

        entry: Dict[str, Any] = {
            "game_id": game_id,
            "status": setup.status,
            "ready": setup.ready,
            "game_format": (
                setup.game_format.value
                if hasattr(setup.game_format, "value")
                else str(setup.game_format)
            ),
            "phase_mode": (
                setup.phase_mode.value
                if hasattr(setup.phase_mode, "value")
                else str(setup.phase_mode)
            ),
            "submitted_count": submitted_count,
            "validated_count": validated_count,
            "seat_claimed_count": seat_claimed_count,
            "player_status": player_status_dump,
            "created_at": setup.created_at.isoformat(),
            "updated_at": setup.updated_at.isoformat(),
            "players": [
                player_id
                for player_id, status in player_status_dump.items()
                if status.get("submitted")
            ],
            "max_players": setup.max_players,
        }

        if setup.ready and game_id in game_engine.games:
            game_state = game_engine.games[game_id]
            entry["status"] = "ongoing"
            entry["players"] = [player.id for player in game_state.players]
            entry["active_player"] = game_state.active_player
            entry["turn"] = game_state.turn
            entry["created_at"] = game_state.created_at.isoformat()
            entry["updated_at"] = game_state.updated_at.isoformat()
            processed_games.add(game_id)

        games_list.append(entry)

    for game_id, game_state in game_engine.games.items():
        if game_id in processed_games:
            continue
        games_list.append(
            {
                "game_id": game_id,
                "status": "ongoing",
                "ready": True,
                "game_format": getattr(
                    game_state.game_format, "value", str(game_state.game_format)
                ),
                "phase_mode": getattr(
                    game_state.phase_mode, "value", str(game_state.phase_mode)
                ),
                "submitted_count": len(game_state.players),
                "validated_count": len(game_state.players),
                "seat_claimed_count": len(game_state.players),
                "player_status": {},
                "players": [player.id for player in game_state.players],
                "active_player": game_state.active_player,
                "turn": game_state.turn,
                "max_players": len(game_state.players),
                "created_at": game_state.created_at.isoformat(),
                "updated_at": game_state.updated_at.isoformat(),
            }
        )

    return games_list


@router.delete("/games/{game_id}")
async def end_game(
    game_id: str, player_id: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    End a game and remove it from the active lists.
    """
    game_state = game_engine.games.get(game_id)
    setup_state = game_engine.game_setups.get(game_id)

    if not game_state and not setup_state:
        raise HTTPException(status_code=404, detail="Game not found")

    player_label = None
    if player_id:
        for player in getattr(game_state, "players", []):
            if getattr(player, "id", None) == player_id:
                player_label = getattr(player, "name", player_id)
                break
        player_label = player_label or player_id
    else:
        player_label = "system"

    if game_state:
        action_info = {
            "action": "end_game",
            "player": player_id or "system",
            "success": True,
            "message": f"Game ended by {player_label}",
        }
        await broadcast_game_update(game_id, game_state, action_info)

    game_engine.end_game(game_id)

    return {"success": True, "message": f"Game {game_id} has been ended"}


@router.post("/games/{game_id}/restart")
async def restart_game(game_id: str) -> Dict[str, Any]:
    """
    Restart a game using the originally submitted decks and player seats.
    """
    try:
        game_state = game_engine.restart_game(game_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await broadcast_game_update(
        game_id,
        game_state,
        {"action": "restart_game", "player": "system", "success": True},
    )

    return {"success": True, "game_state": game_state.model_dump(mode="json")}


@router.get("/games/{game_id}/setup")
async def get_game_setup_status(
    game_id: str,
    player: Optional[str] = Query(default=None),
    player_name: Optional[str] = Query(default=None),
) -> GameSetupStatus:
    """
    Get game setup status (for deck import phase).
    Creates the game setup if it doesn't exist.
    Optionally claims a seat if player parameter is provided.
    """
    setup = game_engine.get_game_setup_status(game_id)
    if not setup:
        # Auto-create setup if it doesn't exist (allows direct URL navigation)
        setup = game_engine.create_game_setup(game_id=game_id)

    # If a player seat is requested, try to claim it
    if player and player.startswith("player"):
        try:
            setup = game_engine.claim_player_seat(
                game_id=game_id, player_id=player, player_name=player_name
            )
        except ValueError:
            pass  # Seat might already be claimed, continue with current setup

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
    game_id: str, request: dict, card_service: CardService = Depends(get_card_service)
) -> GameSetupStatus:
    """
    Submit a deck for a specific player in the game setup phase.
    Once both players have submitted valid decks, the game will initialize.
    """
    player_id = request.get("player_id")
    decklist_text = str(request.get("decklist_text", "") or "").strip()
    decklist_url = str(
        request.get("decklist_url") or request.get("deck_url") or ""
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
                status_code=400, detail=f"Error importing deck from URL: {exc}"
            )

    if not decklist_text and deck is None:
        raise HTTPException(status_code=400, detail="decklist_text is required")

    try:
        if deck is None:
            deck = await card_service.parse_decklist(decklist_text)

        setup_status = game_engine.submit_player_deck(
            game_id=game_id, player_id=player_id, deck=deck
        )

        return setup_status

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error submitting deck: {str(e)}")


@router.post("/games/{game_id}/claim-seat")
async def claim_seat(game_id: str, request: dict) -> GameSetupStatus:
    """Mark a seat as occupied when a player joins the room."""
    player_id = request.get("player_id")
    player_name = request.get("player_name")
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id is required")

    try:
        setup_status = game_engine.claim_player_seat(
            game_id=game_id, player_id=player_id, player_name=player_name
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
                detail=f"Invalid game_format '{raw_format}'. Allowed values: {allowed_formats}",
            )

    if raw_phase_mode is not None:
        normalized_phase = str(raw_phase_mode).strip().lower().replace(" ", "_")
        try:
            phase_mode = PhaseMode(normalized_phase)
        except ValueError:
            allowed_modes = ", ".join(mode.value for mode in PhaseMode)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase_mode '{raw_phase_mode}'. Allowed values: {allowed_modes}",
            )

    try:
        setup_status = game_engine.update_game_settings(
            game_id=game_id, game_format=game_format, phase_mode=phase_mode
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
async def get_game_ui_data(game_id: str, viewer_id: Optional[str] = None) -> dict:
    """
    Get game data optimized for UI rendering.

    Uses compact format with separated card_instances and card_catalog
    to reduce payload size. The viewer_id parameter controls what
    information is revealed for face-down cards.

    Args:
        game_id: The game identifier
        viewer_id: Optional player ID viewing this data. If provided,
                   face-down cards owned by this player will include
                   their identity in the response.

    Returns:
        Compact game state with card_instances and card_catalog
    """
    if game_id not in game_engine.games:
        raise HTTPException(status_code=404, detail="Game not found")

    game_state = game_engine.games[game_id]
    return game_state.to_compact_ui_data(viewer_id=viewer_id)


@router.post("/games/{game_id}/action")
async def perform_game_action(
    game_id: str, request: dict, engine: SimpleGameEngine = Depends(get_game_engine)
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
            f"Available: {action_registry.list_actions()}",
        )

    if game_id not in engine.games:
        raise HTTPException(status_code=404, detail="Game not found")

    current_state = engine.games[game_id]

    if "player_id" in request:
        player_id = request["player_id"]
    else:
        if action_type in ["pass_priority", "resolve_stack"]:
            priority_index = current_state.priority_player
            player_id = (
                current_state.players[priority_index].id
                if 0 <= priority_index < len(current_state.players)
                else f"player{priority_index + 1}"
            )
        else:
            active_index = current_state.active_player
            player_id = (
                current_state.players[active_index].id
                if 0 <= active_index < len(current_state.players)
                else f"player{active_index + 1}"
            )

    try:
        handler = handler_info["handler"]
        action_data = await handler(game_id, request, current_state)

        final_action_type = action_data.get("action_type", action_type)

        action_params = {
            k: v
            for k, v in action_data.items()
            if k not in ["broadcast_data", "action_type"]
        }
        action = GameAction(
            player_id=player_id, action_type=final_action_type, **action_params
        )

        game_state = await engine.process_action(game_id, action)

        broadcast_info = {"action": action_type, "player": player_id, "success": True}
        broadcast_info.update(action_data.get("broadcast_data", {}))
        if broadcast_info.get("face_down"):
            broadcast_info.setdefault("face_down_owner", player_id)

        await broadcast_game_update(game_id, game_state, broadcast_info)

        return {"success": True, "game_state": game_state.model_dump(mode="json")}

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
async def shuffle_library_legacy(game_id: str, request: Optional[dict] = None) -> dict:
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
async def resolve_stack_legacy(game_id: str, request: Optional[dict] = None) -> dict:
    """Legacy endpoint for resolve-stack."""
    action_request = {"action_type": "resolve_stack"}
    if request:
        action_request.update(request)
    return await perform_game_action(game_id, action_request, get_game_engine())


@router.post("/games/{game_id}/pass-priority")
async def pass_priority_legacy(game_id: str, request: Optional[dict] = None) -> dict:
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
    request: dict, card_service: CardService = Depends(get_card_service)
) -> Deck:
    """Parse a decklist from text format and create a Deck object."""
    decklist_text = str(request.get("decklist_text", "") or "").strip()
    decklist_url = str(
        request.get("decklist_url") or request.get("deck_url") or ""
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
        raise HTTPException(status_code=400, detail=f"Error parsing decklist: {str(e)}")


@router.post("/decks/import-url")
async def import_deck_from_url(
    request: dict, card_service: CardService = Depends(get_card_service)
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
            "deck_name": deck.name,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Error importing deck from URL: {exc}"
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
        "description": "Use POST /games/{game_id}/action with action_type parameter",
    }


@router.get("/games/{game_id}/replay")
async def get_game_replay(game_id: str) -> Dict[str, Any]:
    """
    Get the full replay history for a game.

    Returns a compact structure with:
    - game_id: The game identifier
    - timeline: List of game states (referencing cards by card_id)

    Card definitions are not included - they can be fetched via /cards/{card_id}
    when replaying. This significantly reduces replay file size.
    """
    if game_id in game_engine.replays:
        return {
            "game_id": game_id,
            "timeline": game_engine.replays[game_id],
        }

    # Fallback for games without recorded history (e.g. started before restart)
    if game_id in game_engine.games:
        current_state = game_engine.games[game_id]
        # Create a synthetic single-step timeline using compact format
        # Exclude card_catalog - not needed for replay
        compact_data = current_state.to_compact_ui_data()
        synthetic_step = {
            "timestamp": time.time(),
            "state": compact_data,
            "action": {"action_type": "snapshot", "player_id": "system"},
        }
        return {
            "game_id": game_id,
            "timeline": [synthetic_step],
        }

    raise HTTPException(status_code=404, detail="Replay not found for this game")


# =============================================================================
# Pricing API endpoints (data loaded in memory at startup)
# =============================================================================


@router.post("/pricing/lookup")
async def lookup_card_prices(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Look up prices for a batch of card names.

    Request body:
        { "card_names": ["Lightning Bolt", "Ragavan, Nimble Pilferer", ...] }

    Response:
        { "prices": { "Lightning Bolt": 2.50, "Ragavan, Nimble Pilferer": 85.00, ... } }

    Cards without prices will have null values.
    Data is loaded in memory at server startup for fast O(1) lookups.
    """
    card_names = request.get("card_names", [])

    if not isinstance(card_names, list):
        raise HTTPException(status_code=400, detail="card_names must be a list")

    if len(card_names) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 cards per request")

    prices = lookup_prices(card_names)

    return {"prices": prices}


@router.get("/pricing/status")
async def get_pricing_status() -> Dict[str, Any]:
    """
    Get the status of the pricing data cache.
    Useful for debugging and monitoring.
    """
    return get_memory_usage()


@router.get("/formats/stats")
async def get_format_stats() -> Dict[str, Any]:
    """
    Get format statistics for the formats dashboard.
    Returns coverage information and card counts per format.
    """
    from app.backend.services.format_stats_service import get_format_statistics

    return get_format_statistics()
