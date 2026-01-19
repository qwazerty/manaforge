"""
Dictionary-like proxies backed by PostgreSQL.

These classes behave like dictionaries but persist all operations to the database.
This allows gradual migration from in-memory dicts to DB-backed storage.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional, TypeVar, Generic

from psycopg import sql

from app.backend.core.db import connect
from app.backend.models.game import GameState, GameSetupStatus, DraftRoom, Deck

T = TypeVar("T")

DEFAULT_ACTION_HISTORY_LIMIT = 10000
DEFAULT_CHAT_MESSAGES_LIMIT = 1000


class DBDictProxy(Generic[T]):
    """
    Base class for dict-like proxies backed by PostgreSQL.

    Subclasses must implement:
    - _table_name: The database table name
    - _id_column: The primary key column name
    - _data_column: The JSONB column storing the data
    - _serialize(value): Convert value to JSON-serializable dict
    - _deserialize(data): Convert JSON data back to the model
    """

    _table_name: str
    _id_column: str = "id"
    _data_column: str

    def _serialize(self, value: T) -> Dict[str, Any]:
        raise NotImplementedError

    def _deserialize(self, data: Dict[str, Any]) -> T:
        raise NotImplementedError

    def _sql_table(self) -> sql.Identifier:
        return sql.Identifier(self._table_name)

    def _sql_id_col(self) -> sql.Identifier:
        return sql.Identifier(self._id_column)

    def _sql_data_col(self) -> sql.Identifier:
        return sql.Identifier(self._data_column)

    def __contains__(self, key: str) -> bool:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT 1 FROM {} WHERE {} = %s").format(
                    self._sql_table(), self._sql_id_col()
                )
                cur.execute(query, (key,))
                return cur.fetchone() is not None

    def __getitem__(self, key: str) -> T:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT {} FROM {} WHERE {} = %s").format(
                    self._sql_data_col(), self._sql_table(), self._sql_id_col()
                )
                cur.execute(query, (key,))
                row = cur.fetchone()
                if row is None:
                    raise KeyError(key)
                return self._deserialize(row[0])

    def __setitem__(self, key: str, value: T) -> None:
        data = self._serialize(value)
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL(
                    """
                    INSERT INTO {} ({}, {})
                    VALUES (%s, %s)
                    ON CONFLICT ({}) DO UPDATE SET
                        {} = EXCLUDED.{}
                """
                ).format(
                    self._sql_table(),
                    self._sql_id_col(),
                    self._sql_data_col(),
                    self._sql_id_col(),
                    self._sql_data_col(),
                    self._sql_data_col(),
                )
                cur.execute(query, (key, json.dumps(data)))
            conn.commit()

    def __delitem__(self, key: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("DELETE FROM {} WHERE {} = %s").format(
                    self._sql_table(), self._sql_id_col()
                )
                cur.execute(query, (key,))
                if cur.rowcount == 0:
                    raise KeyError(key)
            conn.commit()

    def get(self, key: str, default: Optional[T] = None) -> Optional[T]:
        try:
            return self[key]
        except KeyError:
            return default

    def keys(self) -> List[str]:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT {} FROM {}").format(
                    self._sql_id_col(), self._sql_table()
                )
                cur.execute(query)
                return [row[0] for row in cur.fetchall()]

    def values(self) -> List[T]:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT {} FROM {}").format(
                    self._sql_data_col(), self._sql_table()
                )
                cur.execute(query)
                return [self._deserialize(row[0]) for row in cur.fetchall()]

    def items(self) -> List[tuple]:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT {}, {} FROM {}").format(
                    self._sql_id_col(), self._sql_data_col(), self._sql_table()
                )
                cur.execute(query)
                return [(row[0], self._deserialize(row[1])) for row in cur.fetchall()]

    def __iter__(self) -> Iterator[str]:
        return iter(self.keys())

    def __len__(self) -> int:
        with connect() as conn:
            with conn.cursor() as cur:
                query = sql.SQL("SELECT COUNT(*) FROM {}").format(self._sql_table())
                cur.execute(query)
                row = cur.fetchone()
                return row[0] if row else 0

    def pop(self, key: str, *args) -> T:
        try:
            value = self[key]
            del self[key]
            return value
        except KeyError:
            if args:
                return args[0]
            raise


class GameStatesProxy(DBDictProxy[GameState]):
    """Dict-like proxy for game states stored in PostgreSQL."""

    _table_name = "game_states"
    _id_column = "id"
    _data_column = "state_json"

    def _serialize(self, value: GameState) -> Dict[str, Any]:
        data = value.model_dump(mode="json")
        data.pop("action_history", None)
        data.pop("chat_log", None)
        return data

    def _deserialize(self, data: Dict[str, Any]) -> GameState:
        return GameState.model_validate(data)


class GameSetupsProxy(DBDictProxy[GameSetupStatus]):
    """Dict-like proxy for game setups stored in PostgreSQL."""

    _table_name = "game_setups"
    _id_column = "id"
    _data_column = "setup_json"

    def _serialize(self, value: GameSetupStatus) -> Dict[str, Any]:
        return value.model_dump(mode="json")

    def _deserialize(self, data: Dict[str, Any]) -> GameSetupStatus:
        return GameSetupStatus.model_validate(data)


class DraftRoomsProxy(DBDictProxy[DraftRoom]):
    """Dict-like proxy for draft rooms stored in PostgreSQL."""

    _table_name = "draft_rooms"
    _id_column = "id"
    _data_column = "room_json"

    def _serialize(self, value: DraftRoom) -> Dict[str, Any]:
        return value.model_dump(mode="json")

    def _deserialize(self, data: Dict[str, Any]) -> DraftRoom:
        return DraftRoom.model_validate(data)


class ReplaysProxy:
    """
    Dict-like proxy for replay timelines stored in PostgreSQL.

    Supports append operations and retrieval of full timelines.
    """

    def __contains__(self, game_id: str) -> bool:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM game_replays WHERE game_id = %s LIMIT 1", (game_id,)
                )
                return cur.fetchone() is not None

    def __getitem__(self, game_id: str) -> List[Dict[str, Any]]:
        with connect() as conn:
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

                rows = cur.fetchall()
                if not rows:
                    raise KeyError(game_id)

                timeline = []
                for row in rows:
                    step = {
                        "state": row[1],
                        "timestamp": row[2].timestamp() if row[2] else None,
                    }
                    if row[0]:
                        step["action"] = row[0]
                    timeline.append(step)

                return timeline

    def get(
        self, game_id: str, default: Optional[List] = None
    ) -> Optional[List[Dict[str, Any]]]:
        try:
            return self[game_id]
        except KeyError:
            return default if default is not None else []

    def append_step(self, game_id: str, step_data: Dict[str, Any]) -> None:
        """Append a replay step to the timeline."""
        action_data = step_data.get("action")
        state_data = step_data.get("state", {})

        with connect() as conn:
            with conn.cursor() as cur:
                # Get next step index
                cur.execute(
                    "SELECT COALESCE(MAX(step_index), -1) + 1 FROM game_replays WHERE game_id = %s",
                    (game_id,),
                )
                row = cur.fetchone()
                step_index = row[0] if row else 0

                cur.execute(
                    """
                    INSERT INTO game_replays (game_id, step_index, action_json, state_json)
                    VALUES (%s, %s, %s, %s)
                """,
                    (
                        game_id,
                        step_index,
                        json.dumps(action_data) if action_data else None,
                        json.dumps(state_data),
                    ),
                )
            conn.commit()

    def __delitem__(self, game_id: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM game_replays WHERE game_id = %s", (game_id,))
            conn.commit()

    def keys(self) -> List[str]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT game_id FROM game_replays")
                return [row[0] for row in cur.fetchall()]


class ActionHistoryProxy:
    """Append-only proxy for action history entries."""

    def append(
        self,
        game_id: str,
        entry: Dict[str, Any],
        max_entries: int = DEFAULT_ACTION_HISTORY_LIMIT,
    ) -> None:
        recorded_at = _timestamp_to_datetime(entry.get("timestamp"))
        payload = json.dumps(entry)

        with connect() as conn:
            with conn.cursor() as cur:
                if recorded_at:
                    cur.execute(
                        """
                        INSERT INTO action_history (game_id, action_json, recorded_at)
                        VALUES (%s, %s, %s)
                        """,
                        (game_id, payload, recorded_at),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO action_history (game_id, action_json)
                        VALUES (%s, %s)
                        """,
                        (game_id, payload),
                    )

                if max_entries is not None and max_entries > 0:
                    cur.execute(
                        """
                        DELETE FROM action_history
                        WHERE game_id = %s AND id IN (
                            SELECT id FROM action_history
                            WHERE game_id = %s
                            ORDER BY recorded_at DESC
                            OFFSET %s
                        )
                        """,
                        (game_id, game_id, max_entries),
                    )
            conn.commit()

    def get_recent(
        self, game_id: str, limit: int = DEFAULT_ACTION_HISTORY_LIMIT
    ) -> List[Dict[str, Any]]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT action_json, recorded_at
                    FROM action_history
                    WHERE game_id = %s
                    ORDER BY recorded_at ASC
                    LIMIT %s
                    """,
                    (game_id, limit),
                )

                entries: List[Dict[str, Any]] = []
                for action_json, recorded_at in cur.fetchall():
                    entry = action_json or {}
                    if "timestamp" not in entry and recorded_at:
                        entry["timestamp"] = recorded_at.timestamp()
                    entries.append(entry)
                return entries

    def clear(self, game_id: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM action_history WHERE game_id = %s", (game_id,))
            conn.commit()


class ChatMessagesProxy:
    """Append-only proxy for chat messages."""

    def append(
        self,
        game_id: str,
        entry: Dict[str, Any],
        max_entries: int = DEFAULT_CHAT_MESSAGES_LIMIT,
    ) -> None:
        player_id = entry.get("player")
        message = entry.get("message", "")
        recorded_at = _timestamp_to_datetime(entry.get("timestamp"))

        with connect() as conn:
            with conn.cursor() as cur:
                if recorded_at:
                    cur.execute(
                        """
                        INSERT INTO chat_messages (game_id, player_id, message, recorded_at)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (game_id, player_id, message, recorded_at),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO chat_messages (game_id, player_id, message)
                        VALUES (%s, %s, %s)
                        """,
                        (game_id, player_id, message),
                    )

                if max_entries is not None and max_entries > 0:
                    cur.execute(
                        """
                        DELETE FROM chat_messages
                        WHERE game_id = %s AND id IN (
                            SELECT id FROM chat_messages
                            WHERE game_id = %s
                            ORDER BY recorded_at DESC
                            OFFSET %s
                        )
                        """,
                        (game_id, game_id, max_entries),
                    )
            conn.commit()

    def get_recent(
        self, game_id: str, limit: int = DEFAULT_CHAT_MESSAGES_LIMIT
    ) -> List[Dict[str, Any]]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT player_id, message, recorded_at
                    FROM chat_messages
                    WHERE game_id = %s
                    ORDER BY recorded_at ASC
                    LIMIT %s
                    """,
                    (game_id, limit),
                )

                entries: List[Dict[str, Any]] = []
                for player_id, message, recorded_at in cur.fetchall():
                    entry = {
                        "player": player_id,
                        "message": message,
                        "timestamp": recorded_at.timestamp() if recorded_at else None,
                    }
                    entries.append(entry)
                return entries

    def clear(self, game_id: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM chat_messages WHERE game_id = %s", (game_id,))
            conn.commit()


class PendingDecksProxy:
    """
    Dict-like proxy for pending decks (game_id -> {player_id -> Deck}).
    Stored in a dedicated table.
    """

    def __contains__(self, game_id: str) -> bool:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pending_decks WHERE game_id = %s LIMIT 1", (game_id,)
                )
                return cur.fetchone() is not None

    def __getitem__(self, game_id: str) -> Dict[str, Deck]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT player_id, deck_json
                    FROM pending_decks
                    WHERE game_id = %s
                """,
                    (game_id,),
                )

                rows = cur.fetchall()
                # Always return a dict (empty if no rows)
                return {row[0]: Deck.model_validate(row[1]) for row in rows}

    def __setitem__(self, game_id: str, decks: Dict[str, Deck]) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                # Delete existing entries
                cur.execute("DELETE FROM pending_decks WHERE game_id = %s", (game_id,))

                # Insert new entries
                for player_id, deck in decks.items():
                    deck_json = deck.model_dump(mode="json")
                    cur.execute(
                        """
                        INSERT INTO pending_decks (game_id, player_id, deck_json)
                        VALUES (%s, %s, %s)
                    """,
                        (game_id, player_id, json.dumps(deck_json)),
                    )
            conn.commit()

    def __delitem__(self, game_id: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM pending_decks WHERE game_id = %s", (game_id,))
            conn.commit()

    def get(self, game_id: str, default: Optional[Dict] = None) -> Dict[str, Deck]:
        result = self[game_id]
        return result if result else (default if default is not None else {})

    def pop(self, game_id: str, *args) -> Dict[str, Deck]:
        """Remove and return decks for a game."""
        try:
            value = self[game_id]
            del self[game_id]
            return value
        except KeyError:
            if args:
                return args[0]
            return {}

    def set_player_deck(self, game_id: str, player_id: str, deck: Deck) -> None:
        """Set a single player's deck."""
        deck_json = deck.model_dump(mode="json")
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO pending_decks (game_id, player_id, deck_json)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (game_id, player_id) DO UPDATE SET
                        deck_json = EXCLUDED.deck_json
                """,
                    (game_id, player_id, json.dumps(deck_json)),
                )
            conn.commit()


def _timestamp_to_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    return None


class CubePoolsProxy:
    """
    Dict-like proxy for cube card pools.
    Stores the pool, cursor, and cache for each draft room.
    """

    def __contains__(self, room_id: str) -> bool:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM draft_rooms WHERE id = %s AND cube_pool IS NOT NULL",
                    (room_id,),
                )
                return cur.fetchone() is not None

    def __getitem__(self, room_id: str) -> List[str]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT cube_pool FROM draft_rooms WHERE id = %s", (room_id,)
                )
                row = cur.fetchone()
                if row is None or row[0] is None:
                    raise KeyError(room_id)
                return row[0]

    def __setitem__(self, room_id: str, pool: List[str]) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE draft_rooms
                    SET cube_pool = %s, pool_cursor = 0
                    WHERE id = %s
                """,
                    (json.dumps(pool), room_id),
                )
            conn.commit()

    def __delitem__(self, room_id: str) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE draft_rooms
                    SET cube_pool = NULL, pool_cursor = 0, cube_cache = NULL
                    WHERE id = %s
                """,
                    (room_id,),
                )
            conn.commit()

    def get(self, room_id: str, default: Optional[List] = None) -> Optional[List[str]]:
        try:
            return self[room_id]
        except KeyError:
            return default


class CubePoolCursorsProxy:
    """Dict-like proxy for cube pool cursors (position in the shuffled pool)."""

    def __getitem__(self, room_id: str) -> int:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT pool_cursor FROM draft_rooms WHERE id = %s", (room_id,)
                )
                row = cur.fetchone()
                if row is None:
                    raise KeyError(room_id)
                return row[0] or 0

    def __setitem__(self, room_id: str, cursor: int) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE draft_rooms SET pool_cursor = %s WHERE id = %s",
                    (cursor, room_id),
                )
            conn.commit()

    def get(self, room_id: str, default: int = 0) -> int:
        try:
            return self[room_id]
        except KeyError:
            return default


class CubeCardCacheProxy:
    """Dict-like proxy for cube card caches (resolved card templates)."""

    def __getitem__(self, room_id: str) -> Dict[str, Dict[str, Any]]:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT cube_cache FROM draft_rooms WHERE id = %s", (room_id,)
                )
                row = cur.fetchone()
                if row is None:
                    raise KeyError(room_id)
                return row[0] or {}

    def __setitem__(self, room_id: str, cache: Dict[str, Dict[str, Any]]) -> None:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE draft_rooms SET cube_cache = %s WHERE id = %s",
                    (json.dumps(cache), room_id),
                )
            conn.commit()

    def get(
        self, room_id: str, default: Optional[Dict] = None
    ) -> Dict[str, Dict[str, Any]]:
        try:
            return self[room_id]
        except KeyError:
            return default if default is not None else {}

    def setdefault(self, room_id: str, default: Dict) -> Dict[str, Dict[str, Any]]:
        try:
            existing = self[room_id]
            if existing:
                return existing
        except KeyError:
            pass
        self[room_id] = default
        return default

    def update_cache(self, room_id: str, key: str, value: Dict[str, Any]) -> None:
        """Update a single cache entry."""
        cache = self.get(room_id, {})
        cache[key] = value
        self[room_id] = cache
