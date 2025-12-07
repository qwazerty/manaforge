"""Simple PostgreSQL connection helper."""

import os
import psycopg
from typing import Optional

from app.core.config import settings


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


def connect() -> psycopg.Connection:
    """Return a blocking psycopg connection (use for startup/load tasks)."""

    return psycopg.connect(get_database_url())
