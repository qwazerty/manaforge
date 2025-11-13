"""
Decorators and utilities for API routes.
"""

from functools import wraps
from typing import Callable, Optional, Dict
import time
from fastapi import HTTPException

from app.models.game import GameAction, GameState
from app.services.game_engine import SimpleGameEngine


async def broadcast_game_update(
    game_id: str, game_state: GameState, action_info: Optional[dict] = None
):
    """Broadcast game state update to all connected clients."""
    try:
        from app.api.websocket import manager
        from app.api.routes import game_engine
        
        message = {
            "type": "game_state_update",
            "game_state": game_state.model_dump(mode="json"),
            "timestamp": game_state.turn if hasattr(game_state, 'turn') else None
        }
        
        if action_info:
            action_entry = dict(action_info)
            action_entry.setdefault("timestamp", time.time())
            action_entry.setdefault("origin", "server")

            phase_value = getattr(game_state, 'phase', None)
            if phase_value is not None:
                action_entry.setdefault(
                    "phase",
                    getattr(phase_value, "value", str(phase_value))
                )

            turn_value = getattr(game_state, 'turn', None)
            if turn_value is not None:
                action_entry.setdefault("turn", turn_value)

            active_index = getattr(game_state, 'active_player', None)
            if (
                isinstance(active_index, int) and
                0 <= active_index < len(getattr(game_state, 'players', []))
            ):
                active_player = game_state.players[active_index]
                action_entry.setdefault("turn_player_id", getattr(active_player, 'id', None))
                action_entry.setdefault("turn_player_name", getattr(active_player, 'name', None))

            game_engine.record_action_history(game_id, action_entry)
            message["action_result"] = action_entry
        
        await manager.broadcast_to_game(game_id, message)
        print(f"Broadcasted game state update for game {game_id}")
        
    except Exception as e:
        print(f"Error broadcasting game update: {e}")


def game_action_handler(action_type: str):
    """
    Decorator that centralizes common game action logic:
    - Game existence validation
    - Player ID extraction
    - Action creation and processing
    - WebSocket broadcasting
    - Error handling
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(
            game_id: str,
            request: Optional[Dict] = None,
            game_engine: SimpleGameEngine = None
        ):
            if game_id not in game_engine.games:
                raise HTTPException(status_code=404, detail="Game not found")
            
            current_state = game_engine.games[game_id]
            
            if request and "player_id" in request:
                player_id = request["player_id"]
            else:
                if action_type in ["pass_priority", "resolve_stack"]:
                    player_id = f"player{current_state.priority_player}"
                else:
                    player_id = str(current_state.active_player)
            
            action_data = await func(game_id, request, current_state)
            
            action = GameAction(
                player_id=player_id,
                action_type=action_type,
                **action_data
            )
            
            try:
                game_state = game_engine.process_action(game_id, action)
                
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
        
        return wrapper
    return decorator


class ActionRegistry:
    """Registry for action handlers with validation and dispatch."""
    
    def __init__(self):
        self.handlers = {}
    
    def register(self, action_type: str, required_fields: Optional[list] = None):
        """Register an action handler with validation."""
        def decorator(func):
            self.handlers[action_type] = {
                "handler": func,
                "required_fields": required_fields or []
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
