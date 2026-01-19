"""
Minimal user service for signup, with secure password hashing and DB persistence.

Security notes:
- Passwords are hashed with bcrypt (passlib) and never stored or returned in plaintext.
- Unique constraints on username and email enforced at DB level.
- Schema is ensured via migrations on first use (safe in multi-instance with advisory locks).
"""

from __future__ import annotations

from typing import Any, Dict

from psycopg import errors
from passlib.hash import bcrypt

from app.backend.core import db
from app.backend.core.schema import apply_migrations


def _ensure_schema() -> None:
    """Apply pending migrations before auth operations."""
    apply_migrations()


def _validate_signup(username: str, email: str, password: str) -> None:
    if not username or len(username.strip()) < 3:
        raise ValueError("Le pseudo doit contenir au moins 3 caractères.")
    if not email or "@" not in email:
        raise ValueError("Adresse e-mail invalide.")
    if not password or len(password) < 8:
        raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")


def create_user(username: str, email: str, password: str) -> Dict[str, Any]:
    """
    Create a new user with a bcrypt-hashed password.

    Raises ValueError for validation errors and psycopg.errors.UniqueViolation
    when username/email already exists.
    """
    _validate_signup(username, email, password)
    password_hash = bcrypt.using(rounds=12).hash(password)

    with db.connect() as conn:
        _ensure_schema()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (username, email, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id, username, email, is_admin, created_at;
                    """,
                    (username.strip(), email.strip().lower(), password_hash),
                )
                row = cur.fetchone()
            conn.commit()
        except errors.UniqueViolation as exc:
            conn.rollback()
            # Prefer clear message without leaking which field
            raise ValueError("Ce pseudo ou cet e-mail est déjà utilisé.") from exc

    if not row:
        raise RuntimeError("Echec de création du compte.")

    return {
        "id": row[0],
        "username": row[1],
        "email": row[2],
        "is_admin": row[3],
        "created_at": row[4],
    }
