"""
Repository for persisting and retrieving game states from PostgreSQL.

This replaces the in-memory dictionaries in SimpleGameEngine for multi-worker support.
Uses connection pooling for improved performance.
"""

import json
from typing import Any, Dict, List, Optional

from app.backend.core.db import get_connection
from app.backend.models.game import GameState, GameSetupStatus


class GameStateRepository:
    """
    Repository for game state persistence in PostgreSQL.

    Provides CRUD operations for GameState objects, replacing the
    in-memory `games` dictionary in SimpleGameEngine.
    """

    def get(self, game_id: str) -> Optional[GameState]:
        """Retrieve a game state by ID."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT state_json FROM game_states WHERE id = %s", (game_id,)
                )
                row = cur.fetchone()
                if row:
                    return GameState.model_validate(row[0])
        return None

    def save(self, game_state: GameState) -> None:
        """Save or update a game state."""
        state_json = game_state.model_dump(mode="json")
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO game_states (id, status, state_json)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        state_json = EXCLUDED.state_json
                """,
                    (game_state.id, "active", json.dumps(state_json)),
                )
            conn.commit()

    def delete(self, game_id: str) -> bool:
        """Delete a game state. Returns True if a row was deleted."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM game_states WHERE id = %s", (game_id,))
                deleted = cur.rowcount > 0
            conn.commit()
        return deleted

    def exists(self, game_id: str) -> bool:
        """Check if a game state exists."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM game_states WHERE id = %s", (game_id,))
                return cur.fetchone() is not None

    def list_active(self, limit: int = 100) -> List[str]:
        """List IDs of active games."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id FROM game_states
                    WHERE status = 'active'
                    ORDER BY updated_at DESC
                    LIMIT %s
                """,
                    (limit,),
                )
                return [row[0] for row in cur.fetchall()]


class GameSetupRepository:
    """Repository for game setup status persistence."""

    def get(self, game_id: str) -> Optional[GameSetupStatus]:
        """Retrieve a game setup by ID."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT setup_json FROM game_setups WHERE id = %s", (game_id,)
                )
                row = cur.fetchone()
                if row:
                    return GameSetupStatus.model_validate(row[0])
        return None

    def save(self, setup: GameSetupStatus) -> None:
        """Save or update a game setup."""
        setup_json = setup.model_dump(mode="json")
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO game_setups (id, setup_json)
                    VALUES (%s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        setup_json = EXCLUDED.setup_json
                """,
                    (setup.game_id, json.dumps(setup_json)),
                )
            conn.commit()

    def delete(self, game_id: str) -> bool:
        """Delete a game setup."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM game_setups WHERE id = %s", (game_id,))
                deleted = cur.rowcount > 0
            conn.commit()
        return deleted


class ReplayRepository:
    """Repository for game replay persistence."""

    def append_step(
        self,
        game_id: str,
        step_index: int,
        state_data: Dict[str, Any],
        action_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Append a replay step."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO game_replays (game_id, step_index, action_json, state_json)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (game_id, step_index) DO UPDATE SET
                        action_json = EXCLUDED.action_json,
                        state_json = EXCLUDED.state_json
                """,
                    (
                        game_id,
                        step_index,
                        json.dumps(action_data) if action_data else None,
                        json.dumps(state_data),
                    ),
                )
            conn.commit()

    def get_timeline(self, game_id: str) -> List[Dict[str, Any]]:
        """Get the full replay timeline for a game."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT action_json, state_json, recorded_at
                    FROM game_replays
                    WHERE game_id = %s
                    ORDER BY step_index ASC
                """,
                    (game_id,),
                )

                timeline = []
                for row in cur.fetchall():
                    step = {
                        "state": row[1],
                        "timestamp": row[2].timestamp() if row[2] else None,
                    }
                    if row[0]:
                        step["action"] = row[0]
                    timeline.append(step)

                return timeline

    def get_step_count(self, game_id: str) -> int:
        """Get the number of replay steps for a game."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM game_replays WHERE game_id = %s", (game_id,)
                )
                row = cur.fetchone()
                return row[0] if row else 0


class ActionHistoryRepository:
    """Repository for action history persistence."""

    MAX_HISTORY = 10000

    def append(self, game_id: str, action_data: Dict[str, Any]) -> None:
        """Append an action to the history."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO action_history (game_id, action_json)
                    VALUES (%s, %s)
                """,
                    (game_id, json.dumps(action_data)),
                )
            conn.commit()

    def get_recent(self, game_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent actions for a game."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT action_json FROM action_history
                    WHERE game_id = %s
                    ORDER BY recorded_at DESC
                    LIMIT %s
                """,
                    (game_id, limit),
                )

                # Return in chronological order
                return [row[0] for row in reversed(cur.fetchall())]

    def cleanup_old(self, game_id: str) -> None:
        """Remove old actions beyond the max history limit."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Use CTE for better performance than correlated subquery
                cur.execute(
                    """
                    WITH threshold AS (
                        SELECT id FROM action_history
                        WHERE game_id = %s
                        ORDER BY id DESC
                        LIMIT 1 OFFSET %s
                    )
                    DELETE FROM action_history
                    WHERE game_id = %s
                    AND id < COALESCE((SELECT id FROM threshold), 0)
                """,
                    (game_id, self.MAX_HISTORY - 1, game_id),
                )
            conn.commit()


class ChatRepository:
    """Repository for chat message persistence."""

    MAX_MESSAGES = 1000

    def append(self, game_id: str, player_id: Optional[str], message: str) -> None:
        """Append a chat message."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chat_messages (game_id, player_id, message)
                    VALUES (%s, %s, %s)
                """,
                    (game_id, player_id, message),
                )
            conn.commit()

    def get_recent(self, game_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent chat messages for a game."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT player_id, message, recorded_at
                    FROM chat_messages
                    WHERE game_id = %s
                    ORDER BY recorded_at DESC
                    LIMIT %s
                """,
                    (game_id, limit),
                )

                # Return in chronological order
                messages = []
                for row in reversed(cur.fetchall()):
                    messages.append(
                        {
                            "player": row[0],
                            "message": row[1],
                            "timestamp": row[2].timestamp() if row[2] else None,
                        }
                    )
                return messages


# Singleton instances for easy import
game_state_repo = GameStateRepository()
game_setup_repo = GameSetupRepository()
replay_repo = ReplayRepository()
action_history_repo = ActionHistoryRepository()
chat_repo = ChatRepository()
