"""
Main FastAPI application.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import Optional
from fastapi.encoders import jsonable_encoder

from app.core.config import settings
from app.api.routes import router
from app.api.websocket import websocket_router
from app.api.draft_routes import router as draft_router
from app.services.format_stats_service import get_format_statistics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    yield


app = FastAPI(
    title=settings.app_name,
    description="Magic The Gathering Online Platform",
    version="0.1.0",
)

static_dir = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(router)
app.include_router(websocket_router)
app.include_router(draft_router)

templates = Jinja2Templates(directory="app/templates")


@app.get("/")
async def home(request: Request):
    """Home page."""
    return templates.TemplateResponse(
        request,
        "index.html",
        {"title": "ManaForge"}
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


@app.get("/game-interface/{game_id}")
async def game_interface(request: Request, game_id: str):
    """Game interface template."""
    from app.api.routes import game_engine
    
    if game_id not in game_engine.games:
        return templates.TemplateResponse(
            request,
            "error.html",
            {"message": "Game not found"}
        )
    
    game_state = game_engine.games[game_id]
    
    game_dict = {
        'id': game_state.id,
        'turn': game_state.turn,
        'phase': game_state.phase.value,
        'phase_mode': game_state.phase_mode.value,
        'active_player': game_state.active_player,
        'priority_player': game_state.priority_player,
        'players': [
            {
                'name': player.name,
                'life': player.life,
                'hand': [card.model_dump() for card in player.hand],
                'battlefield': [
                    card.model_dump() for card in player.battlefield
                ],
                'library': len(player.library),
                'graveyard': len(player.graveyard)
                ,
                'reveal_zone': [card.model_dump() for card in getattr(player, 'reveal_zone', [])]
            }
            for player in game_state.players
        ]
    }
    
    return templates.TemplateResponse(
        request,
        "game.html",
        {"game": game_dict}
    )


@app.get("/game-room/{game_id}")
async def game_room(
    request: Request,
    game_id: str,
    player: Optional[str] = Query(default=None),
    player_name: Optional[str] = Query(default=None)
):
    """Game setup status page before the duel starts."""
    from app.api.routes import game_engine

    setup_status = game_engine.get_game_setup_status(game_id)
    if not setup_status:
        setup_status = game_engine.create_game_setup(game_id=game_id)

    player_status = setup_status.player_status
    allowed_players = {"player1", "player2", "spectator"}

    def determine_player_role(requested: Optional[str]) -> str:
        seats = ["player1", "player2"]
        if requested in seats:
            return requested
        if requested == "spectator":
            return "spectator"

        for seat in seats:
            status = player_status.get(seat)
            if not status or not status.seat_claimed:
                return seat
        return "spectator"

    player_role = determine_player_role(player)

    if player_role in {"player1", "player2"}:
        setup_status = game_engine.claim_player_seat(
            game_id=game_id,
            player_id=player_role,
            player_name=player_name
        )
        player_status = setup_status.player_status

    setup_data = setup_status.model_dump(mode="json")
    game_interface_url = request.app.url_path_for("game_interface", game_id=game_id)
    setup_api_url = request.app.url_path_for("get_game_setup_status", game_id=game_id)
    submit_api_url = request.app.url_path_for("submit_player_deck", game_id=game_id)
    game_room_url = str(request.url_for("game_room", game_id=game_id))
    share_links = {
        "player1": f"{game_room_url}?player=player1",
        "player2": f"{game_room_url}?player=player2",
        "spectator": f"{game_room_url}?player=spectator"
    }
    context = {
        "request": request,
        "setup": setup_data,
        "game_id": game_id,
        "player_role": player_role,
        "title": f"Game Room - {game_id}",
        "game_interface_url": game_interface_url,
        "setup_api_url": setup_api_url,
        "submit_api_url": submit_api_url,
        "game_room_url": game_room_url,
        "share_links": share_links
    }
    return templates.TemplateResponse(request, "game_room.html", context)

@app.get("/game")
async def game_lobby(request: Request):
    """Game lobby page."""
    return templates.TemplateResponse(
        request,
        "game_lobby.html",
        {"title": "Game Lobby"}
    )


@app.get("/decks")
async def deck_library(request: Request):
    """Deck library page that lists saved decks."""
    return templates.TemplateResponse(
        request,
        "deck_library.html",
        {"title": "Deck Library"}
    )


@app.get("/decks/builder")
async def deck_manager(request: Request):
    """Deck builder page."""
    return templates.TemplateResponse(
        request,
        "deck_manager.html",
        {"title": "Deck Builder"}
    )


@app.get("/draft")
async def draft_lobby(request: Request):
    """Draft lobby page."""
    return templates.TemplateResponse(
        request,
        "draft_lobby.html",
        {"title": "Draft Lobby"}
    )

@app.get("/draft/{room_id}")
async def draft_room(request: Request, room_id: str):
    """Draft room page."""
    from app.api.draft_routes import get_draft_engine
    engine = get_draft_engine()
    room = engine.get_draft_room(room_id)
    if not room:
        return templates.TemplateResponse(
            request,
            "error.html",
            {"message": "Draft room not found"}
        )
    room_payload = jsonable_encoder(room)
    return templates.TemplateResponse(
        request,
        "draft_room.html",
        {"room": room_payload}
    )


@app.get("/formats")
async def format_stats(request: Request):
    """Format statistics dashboard."""
    stats = get_format_statistics()
    return templates.TemplateResponse(
        request,
        "format_stats.html",
        {
            "title": "Formats & Arena Coverage",
            "stats": stats,
        }
    )


@app.get("/replay")
async def replay_lobby(request: Request):
    """Replay lobby page."""
    return templates.TemplateResponse(
        request,
        "replay_lobby.html",
        {"title": "Replay Lobby"}
    )

@app.get("/replay/{game_id}")
async def replay_room(request: Request, game_id: str):
    """Replay room page."""
    return templates.TemplateResponse(
        request,
        "replay_room.html",
        {"title": f"Replay - {game_id}", "game_id": game_id}
    )
