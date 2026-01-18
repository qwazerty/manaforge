"""
PostgreSQL NOTIFY service for cross-worker communication.

This service allows API workers to send notifications to the WebSocket worker
via PostgreSQL's LISTEN/NOTIFY mechanism.
"""

import json
from typing import Any, Dict

import psycopg

from app.backend.core.db import get_database_url


def notify_game_update(game_id: str, message: Dict[str, Any]) -> None:
    """
    Send a notification to broadcast a game update via WebSocket.
    
    Args:
        game_id: The game ID to broadcast to
        message: The message dict to send to clients
    """
    payload = json.dumps({
        "game_id": game_id,
        "message": message,
    })
    
    with psycopg.connect(get_database_url()) as conn:
        # NOTIFY payload is limited to 8000 bytes, but game states can be larger
        # For large payloads, we just notify that an update happened
        # and the WS server will fetch the full state from DB
        if len(payload) > 7500:
            # Send a lightweight notification - client will request full state
            payload = json.dumps({
                "game_id": game_id,
                "message": {
                    "type": "state_changed",
                    "game_id": game_id,
                },
            })
        
        conn.execute("SELECT pg_notify('game_update', %s)", (payload,))
        conn.commit()


def notify_draft_update(room_id: str, message: Dict[str, Any]) -> None:
    """
    Send a notification to broadcast a draft room update via WebSocket.
    
    Args:
        room_id: The draft room ID to broadcast to
        message: The message dict to send to clients
    """
    payload = json.dumps({
        "room_id": room_id,
        "message": message,
    })
    
    with psycopg.connect(get_database_url()) as conn:
        if len(payload) > 7500:
            payload = json.dumps({
                "room_id": room_id,
                "message": {
                    "type": "draft_state_changed",
                    "room_id": room_id,
                },
            })
        
        conn.execute("SELECT pg_notify('draft_update', %s)", (payload,))
        conn.commit()


async def async_notify_game_update(game_id: str, message: Dict[str, Any]) -> None:
    """
    Async version of notify_game_update.
    Uses a thread pool to avoid blocking the event loop.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, notify_game_update, game_id, message)


async def async_notify_draft_update(room_id: str, message: Dict[str, Any]) -> None:
    """
    Async version of notify_draft_update.
    Uses a thread pool to avoid blocking the event loop.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, notify_draft_update, room_id, message)
