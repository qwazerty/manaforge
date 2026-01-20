"""
Database schema migrations for game state persistence.

Run this script to apply any pending migrations:
    python -m app.backend.core.schema
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional

import psycopg
from psycopg import sql

from app.backend.core.db import connect

MIGRATION_LOCK_ID = 493827561


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    apply: Callable[[psycopg.Cursor], None]


def _migration_001_init(cur: psycopg.Cursor) -> None:
    # Game states table - stores active game sessions
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS game_states (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'setup',
            state_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_game_states_status ON game_states(status);"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);"
    )

    # Game setup status - for games being set up
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS game_setups (
            id TEXT PRIMARY KEY,
            setup_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    # Game replays - action history for replaying games
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS game_replays (
            id BIGSERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            step_index INT NOT NULL,
            action_json JSONB,
            state_json JSONB NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(game_id, step_index)
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_game_replays_game_id ON game_replays(game_id);"
    )

    # Draft rooms - for draft sessions
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS draft_rooms (
            id TEXT PRIMARY KEY,
            room_json JSONB NOT NULL,
            cube_pool JSONB,
            pool_cursor INT DEFAULT 0,
            cube_cache JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_draft_rooms_updated_at ON draft_rooms(updated_at);"
    )

    # Action history - recent actions for a game
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS action_history (
            id BIGSERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            action_json JSONB NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_action_history_game_id ON action_history(game_id);"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_action_history_recorded_at "
        "ON action_history(game_id, recorded_at DESC);"
    )

    # Chat messages
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id BIGSERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            player_id TEXT,
            message TEXT NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON chat_messages(game_id);"
    )

    # Pending decks - decks submitted during game setup
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pending_decks (
            id BIGSERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            deck_json JSONB NOT NULL,
            is_submitted BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(game_id, player_id)
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_pending_decks_game_id ON pending_decks(game_id);"
    )

    # Submitted decks - final decks used to start the game
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS submitted_decks (
            id BIGSERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            deck_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(game_id, player_id)
        );
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_submitted_decks_game_id ON submitted_decks(game_id);"
    )

    # Users
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    # Trigger function for updated_at
    cur.execute(
        """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Apply trigger to tables with updated_at
    for table_name in ["game_states", "game_setups", "draft_rooms"]:
        trigger_name = f"trg_{table_name}_updated_at"
        cur.execute(
            sql.SQL(
                """
                DROP TRIGGER IF EXISTS {trigger} ON {table};
                CREATE TRIGGER {trigger}
                BEFORE UPDATE ON {table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
                """
            ).format(
                trigger=sql.Identifier(trigger_name),
                table=sql.Identifier(table_name),
            )
        )

    # Users updated_at trigger
    cur.execute(
        """
        CREATE OR REPLACE FUNCTION set_users_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    cur.execute("DROP TRIGGER IF EXISTS trg_users_updated_at ON users;")
    cur.execute(
        """
        CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION set_users_updated_at();
        """
    )


def _migration_002_cards_indexes(cur: psycopg.Cursor) -> None:
    """Add indexes to the cards table for faster lookups.

    The cards table is created by update_data.py, but indexes may be missing
    after table swaps. This migration ensures the indexes exist.
    """
    # Check if cards table exists before creating indexes
    cur.execute("SELECT to_regclass('public.cards')")
    row = cur.fetchone()
    if row is None or row[0] is None:
        # Table doesn't exist yet, skip index creation
        return

    # Enable pg_trgm extension for trigram similarity searches
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # Index on oracle_id for fast lookups by oracle ID
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_cards_oracle_id ON cards(oracle_id);"
    )

    # Index on normalized_name for exact name lookups
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_cards_normalized_name ON cards(normalized_name);"
    )

    # Trigram index for fuzzy/partial name searches
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_cards_normalized_name_trgm "
        "ON cards USING gin(normalized_name gin_trgm_ops);"
    )

    # Index on set code for filtering by set
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set);"
    )

    # Index on rarity for filtering
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);"
    )


def _migration_003_performance_indexes(cur: psycopg.Cursor) -> None:
    """Add performance indexes identified by DBA analysis.

    - idx_cards_name: Exact name lookups in _lookup_local_card
    - idx_cards_cmc: Filtering by mana cost
    - idx_chat_messages_game_recorded: Optimized ORDER BY for chat history
    - sets_cache: Materialized view for list_local_sets (6000x speedup)
    
    Note: cardmarket_price indexes are now managed by update_data.py during import.
    """
    # Check if cards table exists before creating indexes
    cur.execute("SELECT to_regclass('public.cards')")
    row = cur.fetchone()
    if row and row[0] is not None:
        # Index on cards.name for exact name lookups (fallback in _lookup_local_card)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);")

        # Index on cards.cmc for filtering by mana cost
        cur.execute("CREATE INDEX IF NOT EXISTS idx_cards_cmc ON cards(cmc);")

        # Materialized view for sets (replaces expensive DISTINCT ON query)
        cur.execute(
            """
            CREATE MATERIALIZED VIEW IF NOT EXISTS sets_cache AS
            SELECT DISTINCT ON (set)
                set as code,
                set_name as name,
                data->>'set_type' AS set_type,
                released_at,
                data->>'icon_svg_uri' AS icon_svg_uri
            FROM cards
            WHERE set IS NOT NULL AND set <> ''
            ORDER BY set, released_at DESC;
            """
        )
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_cache_code ON sets_cache (code);"
        )

    # Composite index for chat messages ORDER BY optimization
    # Replaces simple idx_chat_messages_game_id for queries with ORDER BY recorded_at DESC
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_game_recorded "
        "ON chat_messages (game_id, recorded_at DESC);"
    )


def _migration_004_cleanup_and_perf(cur: psycopg.Cursor) -> None:
    """Cleanup duplicate indexes and add missing performance indexes.

    Identified issues from DBA analysis:
    1. Orphan indexes from old table swap mechanism (various naming conventions)
    2. Orphan staging tables that were not cleaned up
    3. Missing index on cards.data->>'printed_name' - causes 5s seq scans
    4. Missing trigram index on cardmarket_price for LIKE queries on DFC names
    
    Note: idx_cards_printed_name and idx_cardmarket_price_normalized_name_trgm
    are now created by update_data.py during import. This migration ensures they
    exist for databases that haven't been re-imported yet.
    """
    # -------------------------------------------------------------------------
    # 1. Remove orphan indexes from old table swap mechanism
    #    These may have various naming conventions from previous versions
    # -------------------------------------------------------------------------
    orphan_indexes = [
        # Old naming convention duplicates (without _new in staging)
        "idx_cards_new_cmc",
        "idx_cards_new_normalized_name",
        "idx_cards_new_rarity",
        "idx_cards_new_set",
        "idx_cmp_new_price",
        "idx_cmp_new_normalized_name",
        "idx_cmp_new_expansion",
        # Unused price index (not useful for queries)
        "idx_cardmarket_price_price",
    ]
    for idx in orphan_indexes:
        cur.execute(f"DROP INDEX IF EXISTS {idx};")

    # -------------------------------------------------------------------------
    # 2. Remove orphan staging tables
    # -------------------------------------------------------------------------
    cur.execute("DROP TABLE IF EXISTS cards_new CASCADE;")
    cur.execute("DROP TABLE IF EXISTS cardmarket_price_new CASCADE;")

    # -------------------------------------------------------------------------
    # 3. Add index on printed_name for foreign language card lookups
    #    The query `data->>'printed_name' = X` was doing full seq scans (5s+)
    # -------------------------------------------------------------------------
    cur.execute("SELECT to_regclass('public.cards')")
    row = cur.fetchone()
    if row and row[0] is not None:
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_cards_printed_name "
            "ON cards ((data->>'printed_name'));"
        )

    # -------------------------------------------------------------------------
    # 4. Add trigram index on cardmarket_price.normalized_name for LIKE queries
    #    Used for double-faced card price lookups with wildcards
    # -------------------------------------------------------------------------
    cur.execute("SELECT to_regclass('public.cardmarket_price')")
    row = cur.fetchone()
    if row and row[0] is not None:
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_cardmarket_price_normalized_name_trgm "
            "ON cardmarket_price USING gin(normalized_name gin_trgm_ops);"
        )


MIGRATIONS: List[Migration] = [
    Migration(1, "init", _migration_001_init),
    Migration(2, "cards_indexes", _migration_002_cards_indexes),
    Migration(3, "performance_indexes", _migration_003_performance_indexes),
    Migration(4, "cleanup_and_perf", _migration_004_cleanup_and_perf),
]


def _ensure_schema_migrations_table(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )


def apply_migrations(conn: Optional[psycopg.Connection] = None) -> None:
    """Apply any pending schema migrations."""
    owns_conn = conn is None
    if conn is None:
        conn = connect()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(%s);", (MIGRATION_LOCK_ID,))
            try:
                _ensure_schema_migrations_table(cur)
                conn.commit()

                cur.execute("SELECT version FROM schema_migrations ORDER BY version;")
                applied_versions = {row[0] for row in cur.fetchall()}

                for migration in MIGRATIONS:
                    if migration.version in applied_versions:
                        continue
                    migration.apply(cur)
                    cur.execute(
                        "INSERT INTO schema_migrations (version, name) VALUES (%s, %s);",
                        (migration.version, migration.name),
                    )
                    conn.commit()
                    applied_versions.add(migration.version)
            except Exception:
                conn.rollback()
                raise
            finally:
                cur.execute("SELECT pg_advisory_unlock(%s);", (MIGRATION_LOCK_ID,))
                conn.commit()
    finally:
        if owns_conn:
            conn.close()


def create_tables() -> None:
    """Legacy entrypoint (kept for compatibility)."""
    apply_migrations()


def drop_tables() -> None:
    """Drop all game state tables (use with caution!)."""
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DROP TABLE IF EXISTS users CASCADE;
                DROP TABLE IF EXISTS schema_migrations CASCADE;
                DROP TABLE IF EXISTS submitted_decks CASCADE;
                DROP TABLE IF EXISTS pending_decks CASCADE;
                DROP TABLE IF EXISTS chat_messages CASCADE;
                DROP TABLE IF EXISTS action_history CASCADE;
                DROP TABLE IF EXISTS game_replays CASCADE;
                DROP TABLE IF EXISTS game_setups CASCADE;
                DROP TABLE IF EXISTS game_states CASCADE;
                DROP TABLE IF EXISTS draft_rooms CASCADE;
            """
            )
        conn.commit()
        print("⚠️  All game state tables dropped")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--drop":
        drop_tables()
    else:
        apply_migrations()
