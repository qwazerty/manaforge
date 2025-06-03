"""
WebSocket handler for real-time game communication.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio

websocket_router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for game rooms."""
    
    def __init__(self):
        # game_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, game_id: str):
        """Accept and store a WebSocket connection."""
        await websocket.accept()
        
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        
        self.active_connections[game_id].append(websocket)
        print(f"WebSocket connected to game {game_id}")
    
    def disconnect(self, websocket: WebSocket, game_id: str):
        """Remove a WebSocket connection."""
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            
            # Clean up empty game rooms
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
        
        print(f"WebSocket disconnected from game {game_id}")
    
    async def broadcast_to_game(self, game_id: str, message: dict):
        """Broadcast a message to all connections in a game."""
        if game_id not in self.active_connections:
            return
        
        disconnected = []
        
        for connection in self.active_connections[game_id]:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection, game_id)


# Global connection manager
manager = ConnectionManager()


@websocket_router.websocket("/ws/game/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for game communication."""
    await manager.connect(websocket, game_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            
            elif message.get("type") == "game_action":
                # Broadcast action to all players in the game
                await manager.broadcast_to_game(game_id, {
                    "type": "game_update",
                    "action": message.get("action"),
                    "player": message.get("player")
                })
            
            elif message.get("type") == "chat":
                # Broadcast chat message
                await manager.broadcast_to_game(game_id, {
                    "type": "chat",
                    "player": message.get("player", "Anonymous"),
                    "message": message.get("message", "")
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, game_id)
