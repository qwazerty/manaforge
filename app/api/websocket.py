"""
WebSocket handler for real-time game communication.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
import asyncio
import time
import weakref

websocket_router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for game rooms."""
    
    def __init__(self):
        # game_id -> list of (websocket, player_id, last_ping) tuples
        self.active_connections: Dict[str, List[tuple]] = {}
        # Track heartbeat for connection health
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.start_heartbeat()
    
    def start_heartbeat(self):
        """Start the heartbeat task for connection health monitoring."""
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
    
    async def _heartbeat_loop(self):
        """Send periodic ping to all connections and clean up dead ones."""
        while True:
            try:
                await asyncio.sleep(30)  # Ping every 30 seconds
                current_time = time.time()
                
                for game_id in list(self.active_connections.keys()):
                    connections = self.active_connections[game_id]
                    alive_connections = []
                    
                    for websocket, player_id, last_ping in connections:
                        try:
                            # Check if connection is still alive
                            if current_time - last_ping > 60:  # 60 seconds timeout
                                await websocket.close()
                                continue
                                
                            # Send ping
                            await websocket.send_text(json.dumps({
                                "type": "ping",
                                "timestamp": current_time
                            }))
                            alive_connections.append((websocket, player_id, current_time))
                            
                        except Exception:
                            # Connection is dead, skip it
                            continue
                    
                    # Update connections list
                    if alive_connections:
                        self.active_connections[game_id] = alive_connections
                    else:
                        del self.active_connections[game_id]
                        
            except Exception as e:
                print(f"Heartbeat error: {e}")
    
    async def connect(self, websocket: WebSocket, game_id: str, player_id: str = "spectator"):
        """Accept and store a WebSocket connection."""
        await websocket.accept()
        
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        
        # Add connection with player info and current timestamp
        current_time = time.time()
        self.active_connections[game_id].append((websocket, player_id, current_time))
        
        print(f"WebSocket connected to game {game_id} as {player_id} (total: {len(self.active_connections[game_id])})")
        
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "game_id": game_id,
            "player_id": player_id,
            "connected_players": len(self.active_connections[game_id])
        }))
    
    def disconnect(self, websocket: WebSocket, game_id: str):
        """Remove a WebSocket connection."""
        if game_id in self.active_connections:
            # Remove connection from the list
            self.active_connections[game_id] = [
                (ws, pid, ping) for ws, pid, ping in self.active_connections[game_id] 
                if ws != websocket
            ]
            
            # Clean up empty game rooms
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
        
        print(f"WebSocket disconnected from game {game_id}")
    
    async def broadcast_to_game(self, game_id: str, message: dict, exclude_websocket: Optional[WebSocket] = None):
        """Broadcast a message to all connections in a game."""
        if game_id not in self.active_connections:
            print(f"No active connections for game {game_id}")
            return
        
        disconnected = []
        
        for websocket, player_id, last_ping in self.active_connections[game_id]:
            # Skip the excluded websocket (e.g., sender)
            if exclude_websocket and websocket == exclude_websocket:
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending message to WebSocket {player_id}: {e}")
                disconnected.append(websocket)
        
        # Remove disconnected connections
        for websocket in disconnected:
            self.disconnect(websocket, game_id)
        
        remaining_connections = len(self.active_connections.get(game_id, []))
        print(f"Broadcasted message to {remaining_connections} connections in game {game_id}")
    
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


# Global connection manager
manager = ConnectionManager()


@websocket_router.websocket("/ws/game/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for game communication."""
    # Extract player info from query params
    query_params = dict(websocket.query_params)
    player_id = query_params.get('player', 'spectator')
    
    await manager.connect(websocket, game_id, player_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                # Update ping timestamp and respond
                manager.update_ping(websocket, game_id)
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": message.get("timestamp")
                }))
            
            elif message.get("type") == "request_game_state":
                # Client requesting current game state
                from app.api.routes import game_engine
                if game_id in game_engine.games:
                    game_state = game_engine.games[game_id]
                    
                    # Send state to requesting client
                    await websocket.send_text(json.dumps({
                        "type": "game_state_update",
                        "game_state": game_state.model_dump(),
                        "timestamp": time.time()
                    }))
                    
                    # Also broadcast to other players that state was requested
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
                # Process game action and broadcast result
                action_type = message.get("action")
                request_data = message.get("data", {})
                request_data['action_type'] = action_type # Ensure action_type is in the dict for handlers
                
                print(f"[WS] Processing game action: {action_type} from {player_id}")
                
                # Use the same logic as the HTTP endpoint for consistency
                try:
                    from app.api.routes import game_engine
                    from app.api.decorators import action_registry
                    from app.models.game import GameAction

                    # Get handler from registry
                    handler_info = action_registry.get_handler(action_type)
                    if not handler_info:
                        raise ValueError(f"Unknown action_type: {action_type}")

                    current_state = game_engine.games[game_id]
                    
                    # Call the action handler
                    handler = handler_info["handler"]
                    handler_result = await handler(game_id, request_data, current_state)
                    
                    # If the handler overrides the action_type, use the new one.
                    final_action_type = handler_result.get("action_type", action_type)
                    
                    # Create the game action
                    action_params = {k: v for k, v in handler_result.items() if k not in ["broadcast_data", "action_type"]}
                    game_action = GameAction(
                        player_id=player_id,
                        action_type=final_action_type,
                        **action_params
                    )
                    
                    print(f"[WS] Dispatching to engine: {game_action.model_dump_json(indent=2)}")
                    updated_game_state = game_engine.process_action(game_id, game_action)
                    
                    # Prepare broadcast info
                    broadcast_info = {
                        "type": "game_state_update",
                        "game_state": updated_game_state.model_dump(),
                        "action_result": {
                            "success": True,
                            "action": action_type,
                            "player": player_id
                        },
                        "timestamp": time.time()
                    }
                    broadcast_info["action_result"].update(handler_result.get("broadcast_data", {}))

                    # Broadcast updated game state to all players
                    await manager.broadcast_to_game(game_id, broadcast_info)
                    
                except Exception as e:
                    print(f"Error processing game action via WebSocket: {e}")
                    # Send error to requesting client
                    await websocket.send_text(json.dumps({
                        "type": "action_error",
                        "message": str(e),
                        "action": action_type
                    }))
            
            elif message.get("type") == "chat":
                # Broadcast chat message to all players
                await manager.broadcast_to_game(game_id, {
                    "type": "chat",
                    "player": message.get("player", player_id),
                    "message": message.get("message", ""),
                    "timestamp": time.time()
                })
            
            elif message.get("type") == "player_joined":
                # Notify when a player joins
                await manager.broadcast_to_game(game_id, {
                    "type": "player_status",
                    "action": "joined",
                    "player": player_id,
                    "connected_players": manager.get_connection_count(game_id)
                }, exclude_websocket=websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        # Notify remaining players about disconnection
        await manager.broadcast_to_game(game_id, {
            "type": "player_status",
            "action": "disconnected", 
            "player": player_id,
            "connected_players": manager.get_connection_count(game_id)
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, game_id)
        # Notify remaining players about error disconnection
        await manager.broadcast_to_game(game_id, {
            "type": "player_status",
            "action": "error_disconnect",
            "player": player_id,
            "connected_players": manager.get_connection_count(game_id)
        })
