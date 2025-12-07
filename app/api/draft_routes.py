"""
API routes for the draft feature.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import random

from app.models.game import DraftRoom, DraftType
from app.services.card_service import CardService
from app.services.draft_service import DraftService
from app.services.draft_engine import DraftEngine

router = APIRouter(prefix="/api/v1/draft")


# Dependencies
def get_card_service() -> CardService:
    return CardService()


def get_draft_service(
    card_service: CardService = Depends(get_card_service),
) -> DraftService:
    return DraftService(card_service)


# In-memory singleton for DraftEngine
draft_engine = DraftEngine(get_draft_service(get_card_service()))


def get_draft_engine() -> DraftEngine:
    return draft_engine


ADJECTIVES = [
    "Mystic",
    "Arcane",
    "Forbidden",
    "Ancient",
    "Cosmic",
    "Shadowy",
    "Radiant",
    "Eternal",
]
NOUNS = [
    "Nexus",
    "Crucible",
    "Sanctum",
    "Rift",
    "Spire",
    "Obelisk",
    "Chamber",
    "Gauntlet",
]


def generate_random_name():
    """Generates a random room name."""
    return f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)}"


class CreateRoomRequest(BaseModel):
    name: Optional[str] = None
    creator_id: str
    set_code: str
    set_name: str
    max_players: int = 8
    use_cube: bool = False
    cube_url: Optional[str] = None
    cube_list: Optional[str] = None
    cube_name: Optional[str] = None
    draft_type: DraftType = DraftType.BOOSTER_DRAFT


class PickCardRequest(BaseModel):
    player_id: str
    card_unique_id: str


class RenamePlayerRequest(BaseModel):
    player_id: str
    player_name: str


@router.post("/rooms", response_model=DraftRoom)
async def create_draft_room(
    request: CreateRoomRequest, engine: DraftEngine = Depends(get_draft_engine)
):
    """Create a new draft room."""
    room_name = request.name if request.name else generate_random_name()
    try:
        room = await engine.create_draft_room(
            name=room_name,
            set_code=request.set_code,
            set_name=request.set_name,
            max_players=request.max_players,
            creator_id=request.creator_id,
            draft_type=request.draft_type,
            cube_settings={
                "use_cube": request.use_cube,
                "cube_url": request.cube_url,
                "cube_list": request.cube_list,
                "cube_name": request.cube_name,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return room


@router.get("/rooms", response_model=List[DraftRoom])
async def list_draft_rooms(engine: DraftEngine = Depends(get_draft_engine)):
    """List all active draft rooms."""
    return list(engine.draft_rooms.values())


class JoinRoomRequest(BaseModel):
    player_id: str


@router.post("/rooms/{room_id}/join")
async def join_draft_room(
    room_id: str,
    request: JoinRoomRequest,
    engine: DraftEngine = Depends(get_draft_engine),
):
    """Join a draft room."""
    player = engine.add_player_to_room(room_id, request.player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Room not found or full")
    return player


@router.post("/rooms/{room_id}/add-bot")
async def add_bot_to_draft_room(
    room_id: str, engine: DraftEngine = Depends(get_draft_engine)
):
    """Add a bot to a draft room."""
    bot = engine.add_bot_to_room(room_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Room not found or full")
    return bot


@router.post("/rooms/{room_id}/start")
async def start_draft(room_id: str, engine: DraftEngine = Depends(get_draft_engine)):
    """Start the draft."""
    await engine.start_draft(room_id)
    return {"message": "Draft started"}


@router.post("/rooms/{room_id}/pick")
async def pick_card(
    room_id: str,
    request: PickCardRequest,
    engine: DraftEngine = Depends(get_draft_engine),
):
    """Pick a card from a pack."""
    success = engine.pick_card(room_id, request.player_id, request.card_unique_id)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid pick")
    return {"message": "Card picked"}


@router.post("/rooms/{room_id}/rename")
async def rename_player(
    room_id: str,
    request: RenamePlayerRequest,
    engine: DraftEngine = Depends(get_draft_engine),
):
    """Rename a human player in the draft room."""
    try:
        player = engine.rename_player(room_id, request.player_id, request.player_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from app.api.websocket import manager  # Local import to avoid circular dependency

    room = engine.get_draft_room(room_id)
    if room:
        await manager.broadcast_to_game(
            room_id,
            {"type": "draft_state_update", "room_state": room.model_dump(mode="json")},
        )
    return player


@router.get("/sets")
async def search_sets(
    q: Optional[str] = None, draft_service: DraftService = Depends(get_draft_service)
):
    """Search for MTG sets."""
    return await draft_service.search_sets(q)
