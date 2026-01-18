"""
Database schema for game state persistence.

Run this script to create the required tables:
    python -m app.backend.core.schema
"""

import psycopg

from app.backend.core.db import connect


def create_tables() -> None:
    """Create all required tables for game state persistence."""
    with connect() as conn:
        with conn.cursor() as cur:
            # Game states table - stores active game sessions
            cur.execute("""
                CREATE TABLE IF NOT EXISTS game_states (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'setup',
                    state_json JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_game_states_status 
                ON game_states(status);
                
                CREATE INDEX IF NOT EXISTS idx_game_states_updated_at 
                ON game_states(updated_at);
            """)
            
            # Game setup status - for games being set up
            cur.execute("""
                CREATE TABLE IF NOT EXISTS game_setups (
                    id TEXT PRIMARY KEY,
                    setup_json JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
            
            # Game replays - action history for replaying games
            cur.execute("""
                CREATE TABLE IF NOT EXISTS game_replays (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    step_index INT NOT NULL,
                    action_json JSONB,
                    state_json JSONB NOT NULL,
                    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(game_id, step_index)
                );
                
                CREATE INDEX IF NOT EXISTS idx_game_replays_game_id 
                ON game_replays(game_id);
            """)
            
            # Draft rooms - for draft sessions
            cur.execute("""
                CREATE TABLE IF NOT EXISTS draft_rooms (
                    id TEXT PRIMARY KEY,
                    room_json JSONB NOT NULL,
                    cube_pool JSONB,
                    pool_cursor INT DEFAULT 0,
                    cube_cache JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_draft_rooms_updated_at 
                ON draft_rooms(updated_at);
            """)
            
            # Action history - recent actions for a game
            cur.execute("""
                CREATE TABLE IF NOT EXISTS action_history (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    action_json JSONB NOT NULL,
                    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_action_history_game_id 
                ON action_history(game_id);
                
                CREATE INDEX IF NOT EXISTS idx_action_history_recorded_at 
                ON action_history(game_id, recorded_at DESC);
            """)
            
            # Chat messages
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    player_id TEXT,
                    message TEXT NOT NULL,
                    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id 
                ON chat_messages(game_id);
            """)
            
            # Pending decks - decks submitted during game setup
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pending_decks (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    player_id TEXT NOT NULL,
                    deck_json JSONB NOT NULL,
                    is_submitted BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(game_id, player_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_pending_decks_game_id 
                ON pending_decks(game_id);
            """)
            
            # Submitted decks - final decks used to start the game
            cur.execute("""
                CREATE TABLE IF NOT EXISTS submitted_decks (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    player_id TEXT NOT NULL,
                    deck_json JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(game_id, player_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_submitted_decks_game_id 
                ON submitted_decks(game_id);
            """)
            
            # Trigger function for updated_at
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """)
            
            # Apply trigger to tables with updated_at
            for table in ['game_states', 'game_setups', 'draft_rooms']:
                cur.execute(f"""
                    DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};
                    CREATE TRIGGER trg_{table}_updated_at
                    BEFORE UPDATE ON {table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                """)
        
        conn.commit()
        print("✅ Database schema created successfully")


def drop_tables() -> None:
    """Drop all game state tables (use with caution!)."""
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DROP TABLE IF EXISTS submitted_decks CASCADE;
                DROP TABLE IF EXISTS pending_decks CASCADE;
                DROP TABLE IF EXISTS chat_messages CASCADE;
                DROP TABLE IF EXISTS action_history CASCADE;
                DROP TABLE IF EXISTS game_replays CASCADE;
                DROP TABLE IF EXISTS game_setups CASCADE;
                DROP TABLE IF EXISTS game_states CASCADE;
                DROP TABLE IF EXISTS draft_rooms CASCADE;
            """)
        conn.commit()
        print("⚠️  All game state tables dropped")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--drop":
        drop_tables()
    else:
        create_tables()
