from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from psycopg import errors

from app.backend.services import auth_service


class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(payload: SignupRequest):
    """
    Create a new user with a hashed password.
    Returns public user fields only (no password).
    """
    try:
        user = auth_service.create_user(
            username=payload.username,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except errors.DatabaseError as exc:
        # Generic DB error without leaking details
        raise HTTPException(status_code=500, detail="Erreur base de données") from exc

    return user
