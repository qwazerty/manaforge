"""PostgreSQL connection helper with connection pooling."""

import atexit
import os
from contextlib import contextmanager
from typing import Generator, Optional

import psycopg
from psycopg_pool import ConnectionPool

from app.backend.core.config import settings

# Global connection pool
_pool: Optional[ConnectionPool] = None

# Pool configuration
POOL_MIN_SIZE = 2
POOL_MAX_SIZE = 20
POOL_TIMEOUT = 30.0  # seconds to wait for a connection


def get_database_url() -> str:
    url = settings.database_url or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    # Accept SQLAlchemy-style URLs with driver (postgresql+psycopg://) and normalize
    if url.startswith("postgresql+psycopg://"):
        url = "postgresql://" + url[len("postgresql+psycopg://") :]
    if url.startswith("postgres+psycopg://"):
        url = "postgres://" + url[len("postgres+psycopg://") :]
    return url


def get_pool() -> ConnectionPool:
    """Get or create the global connection pool."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            get_database_url(),
            min_size=POOL_MIN_SIZE,
            max_size=POOL_MAX_SIZE,
            timeout=POOL_TIMEOUT,
            open=True,
        )
        # Register cleanup on interpreter shutdown
        atexit.register(_close_pool)
    return _pool


def _close_pool() -> None:
    """Close the connection pool on shutdown."""
    global _pool
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    """
    Get a connection from the pool.

    Usage:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(...)
            conn.commit()
    """
    pool = get_pool()
    with pool.connection() as conn:
        yield conn


def connect() -> psycopg.Connection:
    """
    Return a blocking psycopg connection (legacy interface).

    DEPRECATED: Use get_connection() context manager instead for pooled connections.
    This function still creates a new connection for backwards compatibility
    with code that manages its own connection lifecycle.
    """
    return psycopg.connect(get_database_url())
