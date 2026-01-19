"""
Decorators and utilities for API routes.
"""

import os
from typing import Optional
import time

from app.backend.models.game import GameState


# Detect if we're running as the dedicated WS worker
# The WS worker has direct access to ConnectionManager
# API workers use PostgreSQL NOTIFY to communicate with the WS worker
IS_WS_WORKER = os.environ.get("MANAFORGE_WS_WORKER", "").lower() in ("1", "true", "yes")


async def broadcast_game_update(
    game_id: str, game_state: GameState, action_info: Optional[dict] = None
):
    """
    Broadcast game state update to all connected clients.

    Uses compact format with card_instances for reduced payload size.
    Card definitions are NOT included - clients fetch them via /api/v1/cards/{id}.

    In multi-worker mode:
    - WS worker: Uses ConnectionManager directly
    - API workers: Uses PostgreSQL NOTIFY to relay to WS worker
    """
    try:
        from app.backend.api.routes import game_engine

        # Use compact format for reduced payload size
        action_history = game_engine.get_action_history(game_id)
        chat_log = game_engine.get_chat_log(game_id)
        message = {
            "type": "game_state_update",
            "game_state": game_state.to_compact_ui_data(
                viewer_id=None,
                action_history=action_history,
                chat_log=chat_log,
            ),
            "timestamp": game_state.turn if hasattr(game_state, "turn") else None,
        }

        if action_info:
            action_entry = dict(action_info)
            action_entry.setdefault("timestamp", time.time())
            action_entry.setdefault("origin", "server")

            phase_value = getattr(game_state, "phase", None)
            if phase_value is not None:
                action_entry.setdefault(
                    "phase", getattr(phase_value, "value", str(phase_value))
                )

            turn_value = getattr(game_state, "turn", None)
            if turn_value is not None:
                action_entry.setdefault("turn", turn_value)

            active_index = getattr(game_state, "active_player", None)
            if isinstance(active_index, int) and 0 <= active_index < len(
                getattr(game_state, "players", [])
            ):
                active_player = game_state.players[active_index]
                action_entry.setdefault(
                    "turn_player_id", getattr(active_player, "id", None)
                )
                action_entry.setdefault(
                    "turn_player_name", getattr(active_player, "name", None)
                )

            game_engine.record_action_history(game_id, action_entry)
            message["action_result"] = action_entry

        if IS_WS_WORKER:
            # Direct broadcast via ConnectionManager (we are the WS worker)
            from app.backend.api.websocket import manager

            await manager.broadcast_to_game(game_id, message)
        else:
            # Use PostgreSQL NOTIFY to relay to the WS worker
            from app.backend.services.notify_service import async_notify_game_update

            await async_notify_game_update(game_id, message)

        print(f"Broadcasted game state update for game {game_id}")

    except Exception as e:
        print(f"Error broadcasting game update: {e}")


async def broadcast_draft_update(room_id: str, message: dict):
    """
    Broadcast draft room update to all connected clients.

    In multi-worker mode:
    - WS worker: Uses ConnectionManager directly
    - API workers: Uses PostgreSQL NOTIFY to relay to WS worker
    """
    try:
        if IS_WS_WORKER:
            from app.backend.api.websocket import manager

            await manager.broadcast_to_game(room_id, message)
        else:
            from app.backend.services.notify_service import async_notify_draft_update

            await async_notify_draft_update(room_id, message)

        print(f"Broadcasted draft update for room {room_id}")

    except Exception as e:
        print(f"Error broadcasting draft update: {e}")


class ActionRegistry:
    """Registry for action handlers with validation and dispatch."""

    def __init__(self):
        self.handlers = {}

    def register(self, action_type: str, required_fields: Optional[list] = None):
        """Register an action handler with validation."""

        def decorator(func):
            self.handlers[action_type] = {
                "handler": func,
                "required_fields": required_fields or [],
            }
            return func

        return decorator

    def get_handler(self, action_type: str):
        """Get handler for action type."""
        return self.handlers.get(action_type)

    def list_actions(self):
        """List all registered action types."""
        return list(self.handlers.keys())


action_registry = ActionRegistry()
