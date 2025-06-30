"""
Main FastAPI application.
"""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.config import settings
from app.api.routes import router
from app.api.websocket import websocket_router


async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    pass


app = FastAPI(
    title=settings.app_name,
    description="Magic The Gathering Online Platform",
    version="0.1.0",
)

app.mount("/static", StaticFiles(directory="/app/app/static"), name="static")

app.include_router(router)
app.include_router(websocket_router)

templates = Jinja2Templates(directory="app/templates")


@app.get("/")
async def home(request: Request):
    """Home page."""
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "title": "ManaForge"}
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
            "error.html",
            {"request": request, "message": "Game not found"}
        )
    
    game_state = game_engine.games[game_id]
    
    game_dict = {
        'id': game_state.id,
        'turn': game_state.turn,
        'phase': game_state.phase.value,
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
            }
            for player in game_state.players
        ]
    }
    
    return templates.TemplateResponse(
        "game.html",
        {"request": request, "game": game_dict}
    )


@app.get("/game")
async def game_lobby(request: Request):
    """Game lobby page."""
    return templates.TemplateResponse(
        "game_lobby.html",
        {"request": request, "title": "Game Lobby"}
    )
