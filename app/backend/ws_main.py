"""
Dedicated WebSocket server.

This is a separate FastAPI application that handles only WebSocket connections.
It listens to PostgreSQL NOTIFY events to broadcast game state updates.
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI

from app.backend.core.db import get_database_url

# Mark this process as the WS worker for the decorators module
os.environ["MANAFORGE_WS_WORKER"] = "1"

from app.backend.api.websocket import websocket_router, manager


async def listen_for_notifications():
    """
    Listen for PostgreSQL NOTIFY events and broadcast to WebSocket clients.
    
    Channels:
    - game_update:{game_id} - Broadcast game state to all clients in a game
    - draft_update:{room_id} - Broadcast draft state to all clients in a room
    """
    db_url = get_database_url()
    
    while True:
        try:
            # Use async connection for non-blocking listen
            async with await psycopg.AsyncConnection.connect(db_url) as conn:
                # Subscribe to notification channels
                await conn.execute("LISTEN game_update")
                await conn.execute("LISTEN draft_update")
                print("[WS Server] Listening for PostgreSQL notifications...")
                
                async for notify in conn.notifies():
                    try:
                        channel = notify.channel
                        payload = json.loads(notify.payload) if notify.payload else {}
                        
                        if channel == "game_update":
                            game_id = payload.get("game_id")
                            message = payload.get("message", {})
                            if game_id and message:
                                await manager.broadcast_to_game(game_id, message)
                                
                        elif channel == "draft_update":
                            room_id = payload.get("room_id")
                            message = payload.get("message", {})
                            if room_id and message:
                                await manager.broadcast_to_game(room_id, message)
                                
                    except json.JSONDecodeError as e:
                        print(f"[WS Server] Invalid JSON in notification: {e}")
                    except Exception as e:
                        print(f"[WS Server] Error processing notification: {e}")
                        
        except psycopg.OperationalError as e:
            print(f"[WS Server] Database connection error: {e}")
            print("[WS Server] Reconnecting in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"[WS Server] Unexpected error: {e}")
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Start the notification listener as a background task
    listener_task = asyncio.create_task(listen_for_notifications())
    print("[WS Server] Started PostgreSQL notification listener")
    
    yield
    
    # Cleanup
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass
    print("[WS Server] Stopped PostgreSQL notification listener")


app = FastAPI(
    title="ManaForge WebSocket Server",
    description="Dedicated WebSocket server for real-time game communication",
    version="0.1.0",
    lifespan=lifespan,
)

# Include only WebSocket routes
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "websocket",
        "active_games": len(manager.active_connections),
    }
