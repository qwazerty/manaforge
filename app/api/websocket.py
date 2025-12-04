"""
WebSocket handler for real-time game communication.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
import asyncio
import time


websocket_router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for game rooms."""
    
    def __init__(self):
        self.active_connections: Dict[str, List[tuple]] = {}
        self.heartbeat_task: Optional[asyncio.Task] = None
    
    def ensure_heartbeat(self):
        """
        Start the heartbeat task for connection health monitoring.
        
        This is invoked lazily from async contexts (where an event loop is
        running) to avoid trying to create tasks at import time, which breaks
        our pytest collection.
        """
        if self.heartbeat_task and not self.heartbeat_task.done():
            return
        
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop yet (e.g. during module import). We'll try
            # again once we enter an async context.
            return
        
        self.heartbeat_task = loop.create_task(self._heartbeat_loop())
    
    async def _heartbeat_loop(self):
        """Send periodic ping to all connections and clean up dead ones."""
        while True:
            try:
                await asyncio.sleep(30)
                current_time = time.time()
                
                for game_id in list(self.active_connections.keys()):
                    connections = self.active_connections[game_id]
                    alive_connections = []
                    
                    for websocket, player_id, last_ping in connections:
                        try:
                            if current_time - last_ping > 60:
                                await websocket.close()
                                continue
                                
                            await websocket.send_text(json.dumps({
                                "type": "ping",
                                "timestamp": current_time
                            }))
                            alive_connections.append(
                                (websocket, player_id, current_time)
                            )
                            
                        except Exception:
                            continue
                    
                    if alive_connections:
                        self.active_connections[game_id] = alive_connections
                    else:
                        del self.active_connections[game_id]
                        
            except Exception as e:
                print(f"Heartbeat error: {e}")
    
    async def connect(
        self, websocket: WebSocket, game_id: str, player_id: str = "spectator"
    ):
        """Accept and store a WebSocket connection."""
        await websocket.accept()
        self.ensure_heartbeat()
        
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        
        current_time = time.time()
        self.active_connections[game_id].append(
            (websocket, player_id, current_time)
        )
        
        print(
            f"WebSocket connected to game {game_id} as {player_id} "
            f"(total: {len(self.active_connections[game_id])})"
        )
        
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "game_id": game_id,
            "player_id": player_id,
            "connected_players": len(self.active_connections[game_id])
        }))
    
    def disconnect(self, websocket: WebSocket, game_id: str):
        """Remove a WebSocket connection."""
        if game_id in self.active_connections:
            self.active_connections[game_id] = [
                (ws, pid, ping) for ws, pid, ping in
                self.active_connections[game_id]
                if ws != websocket
            ]
            
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
        
        print(f"WebSocket disconnected from game {game_id}")
    
    async def broadcast_to_game(
        self,
        game_id: str,
        message: dict,
        exclude_websocket: Optional[WebSocket] = None
    ):
        """Broadcast a message to all connections in a game."""
        if game_id not in self.active_connections:
            print(f"No active connections for game {game_id}")
            return
        
        disconnected = []
        
        for websocket, player_id, last_ping in self.active_connections[game_id]:
            if exclude_websocket and websocket == exclude_websocket:
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending message to WebSocket {player_id}: {e}")
                disconnected.append(websocket)
        
        for websocket in disconnected:
            self.disconnect(websocket, game_id)
        
        remaining_connections = len(self.active_connections.get(game_id, []))
        print(
            f"Broadcasted message to {remaining_connections} "
            f"connections in game {game_id}"
        )
    
    def get_connection_count(self, game_id: str) -> int:
        """Get number of active connections for a game."""
        return len(self.active_connections.get(game_id, []))
    
    def update_ping(self, websocket: WebSocket, game_id: str):
        """Update the last ping time for a connection."""
        if game_id in self.active_connections:
            current_time = time.time()
            updated_connections = []
            
            for ws, player_id, last_ping in self.active_connections[game_id]:
                if ws == websocket:
                    updated_connections.append((ws, player_id, current_time))
                else:
                    updated_connections.append((ws, player_id, last_ping))
            
            self.active_connections[game_id] = updated_connections


manager = ConnectionManager()


@websocket_router.websocket("/ws/game/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for game communication."""
    query_params = dict(websocket.query_params)
    player_id = query_params.get('player', 'spectator')
    
    await manager.connect(websocket, game_id, player_id)
    
    # If it's a draft room, broadcast the initial state
    if game_id.startswith("draft-"):
        from app.api.draft_routes import get_draft_engine
        engine = get_draft_engine()
        room = engine.get_draft_room(game_id)
        if room:
            await manager.broadcast_to_game(game_id, {
                "type": "draft_state_update",
                "room_state": room.model_dump(mode="json")
            })
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                manager.update_ping(websocket, game_id)
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": message.get("timestamp")
                }))
            
            elif message.get("type") == "request_game_state":
                from app.api.routes import game_engine
                if game_id in game_engine.games:
                    game_state = game_engine.games[game_id]
                    
                    await websocket.send_text(json.dumps({
                        "type": "game_state_update",
                        "game_state": game_state.model_dump(mode="json"),
                        "timestamp": time.time()
                    }))
                    
                    await manager.broadcast_to_game(game_id, {
                        "type": "state_sync",
                        "requested_by": player_id,
                        "timestamp": time.time()
                    }, exclude_websocket=websocket)
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Game {game_id} not found"
                    }))
            
            elif message.get("type") == "game_action":
                action_type = message.get("action")
                request_data = message.get("data", {})
                request_data['action_type'] = action_type
                request_data['player_id'] = player_id  # Ensure player_id is always set
                
                print(
                    f"[WS] Processing game action: {action_type} from {player_id}"
                )
                
                try:
                    from app.api.routes import game_engine
                    from app.api.decorators import action_registry
                    from app.models.game import GameAction

                    handler_info = action_registry.get_handler(action_type)
                    if not handler_info:
                        raise ValueError(f"Unknown action_type: {action_type}")

                    current_state = game_engine.games[game_id]
                    
                    handler = handler_info["handler"]
                    handler_result = await handler(
                        game_id, request_data, current_state
                    )
                    
                    final_action_type = handler_result.get(
                        "action_type", action_type
                    )
                    
                    action_params = {
                        k: v for k, v in handler_result.items()
                        if k not in ["broadcast_data", "action_type"]
                    }
                    game_action = GameAction(
                        player_id=player_id,
                        action_type=final_action_type,
                        **action_params
                    )
                    
                    print(
                        "[WS] Dispatching to engine: "
                        f"{game_action.model_dump_json(indent=2)}"
                    )
                    updated_game_state = await game_engine.process_action(
                        game_id, game_action
                    )
                    
                    broadcast_info = {
                        "type": "game_state_update",
                        "game_state": updated_game_state.model_dump(mode="json"),
                        "action_result": {
                            "success": True,
                            "action": action_type,
                            "player": player_id
                        },
                        "timestamp": time.time()
                    }
                    broadcast_info["action_result"].update(
                        handler_result.get("broadcast_data", {})
                    )
                    if broadcast_info["action_result"].get("face_down"):
                        broadcast_info["action_result"].setdefault("face_down_owner", player_id)
                    broadcast_info["action_result"].setdefault("origin", "server")
                    broadcast_info["action_result"].setdefault(
                        "timestamp", broadcast_info["timestamp"]
                    )
                    current_phase = getattr(updated_game_state.phase, "value", updated_game_state.phase)
                    if current_phase:
                        broadcast_info["action_result"].setdefault("phase", current_phase)

                    game_engine.record_action_history(
                        game_id,
                        broadcast_info["action_result"]
                    )

                    await manager.broadcast_to_game(game_id, broadcast_info)
                    
                except Exception as e:
                    print(f"Error processing game action via WebSocket: {e}")
                    game_engine.record_action_history(
                        game_id,
                        {
                            "success": False,
                            "action": action_type,
                            "player": player_id,
                            "error": str(e),
                            "origin": "server",
                            "timestamp": time.time()
                        }
                    )
                    await websocket.send_text(json.dumps({
                        "type": "action_error",
                        "message": str(e),
                        "action": action_type
                    }))
            
            elif message.get("type") == "chat":
                from app.api.routes import game_engine
                payload = {
                    "type": "chat",
                    "player": message.get("player", player_id),
                    "message": message.get("message", ""),
                    "timestamp": time.time()
                }
                game_engine.add_chat_message(game_id, payload)
                await manager.broadcast_to_game(game_id, {
                    **payload
                })
            
            elif message.get("type") == "player_joined":
                await manager.broadcast_to_game(game_id, {
                    "type": "player_status",
                    "action": "joined",
                    "player": player_id,
                    "connected_players": manager.get_connection_count(game_id)
                }, exclude_websocket=websocket)
            
            # Handle targeting arrows (visual-only, broadcast to all players)
            elif message.get("type") == "targeting_arrow":
                arrow_action = message.get("action")  # "add" or "remove" or "clear"
                await manager.broadcast_to_game(game_id, {
                    "type": "targeting_arrow",
                    "action": arrow_action,
                    "source_id": message.get("source_id"),
                    "target_id": message.get("target_id"),
                    "player": player_id,
                    "timestamp": time.time()
                })
            
            # Handle random animations (coin flip, dice rolls)
            elif message.get("type") == "random_animation":
                import random
                animation_type = message.get("animation_type")
                player_name = message.get("player", player_id)
                
                # Calculate result server-side
                if animation_type == "coin":
                    result = "Heads" if random.random() < 0.5 else "Tails"
                    action_label = "Coin Flip"
                    result_message = f"🪙 {result}"
                elif animation_type == "d6":
                    result = random.randint(1, 6)
                    action_label = "D6 Roll"
                    result_message = f"🎲 Rolled {result}"
                elif animation_type == "d20":
                    result = random.randint(1, 20)
                    action_label = "D20 Roll"
                    if result == 20:
                        result_message = f"🎯 Rolled 20 - CRITICAL!"
                    elif result == 1:
                        result_message = f"🎯 Rolled 1 - CRITICAL FAIL!"
                    else:
                        result_message = f"🎯 Rolled {result}"
                else:
                    result = None
                    action_label = "Random"
                    result_message = f"Result: {result}"
                
                # Record in action history for persistence
                from app.api.routes import game_engine
                game_engine.record_action_history(game_id, {
                    "action": action_label,
                    "player": player_name,
                    "success": True,
                    "details": {"message": result_message},
                    "origin": "server",
                    "timestamp": time.time()
                })
                
                await manager.broadcast_to_game(game_id, {
                    "type": "random_animation",
                    "animation_type": animation_type,
                    "result": result,
                    "player": player_name,
                    "timestamp": time.time()
                })
            
            # Handle draft-specific messages
            elif game_id.startswith("draft-"):
                from app.api.draft_routes import get_draft_engine
                engine = get_draft_engine()
                room = engine.get_draft_room(game_id)
                if room:
                    if message.get("type") == "add_bot":
                        engine.add_bot_to_room(game_id)
                    elif message.get("type") == "fill_bots":
                        engine.fill_bots(game_id)
                    elif message.get("type") == "start_draft":
                        await manager.broadcast_to_game(game_id, {"type": "draft_starting"})
                        await engine.start_draft(game_id)
                    elif message.get("type") == "pick_card":
                        engine.pick_card(game_id, player_id, message.get("card_unique_id"))
                    elif message.get("type") == "get_decklist":
                        player = next((p for p in room.players if p.id == player_id), None)
                        if player:
                            decklist = ""
                            for card in player.drafted_cards:
                                decklist += f"1 {card.name}\n"
                            await websocket.send_text(json.dumps({
                                "type": "decklist_data",
                                "decklist": decklist
                            }))
                        # Don't broadcast after this, it's a direct response
                        continue

                    await manager.broadcast_to_game(game_id, {
                        "type": "draft_state_update",
                        "room_state": room.model_dump(mode="json")
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        await manager.broadcast_to_game(game_id, {
            "type": "player_status",
            "action": "disconnected",
            "player": player_id,
            "connected_players": manager.get_connection_count(game_id)
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, game_id)
        await manager.broadcast_to_game(game_id, {
            "type": "player_status",
            "action": "error_disconnect",
            "player": player_id,
            "connected_players": manager.get_connection_count(game_id)
        })
