import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.routes import game_engine
from app.models.game import GameState, GamePhase, Player

class TestReplay:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_replay_fallback(self, client):
        # Create a dummy game state without history
        game_id = "test_game_no_history"
        player1 = Player(id="p1", name="P1", library=[])
        player2 = Player(id="p2", name="P2", library=[])
        game_state = GameState(
            id=game_id,
            players=[player1, player2],
            active_player=0,
            phase=GamePhase.BEGIN
        )
        
        # Inject into game engine
        game_engine.games[game_id] = game_state
        # Ensure no replay history exists
        if game_id in game_engine.replays:
            del game_engine.replays[game_id]
            
        # Call endpoint
        response = client.get(f"/api/v1/games/{game_id}/replay")
        
        assert response.status_code == 200
        data = response.json()
        assert data["game_id"] == game_id
        assert len(data["timeline"]) == 1
        assert data["timeline"][0]["action"]["action_type"] == "snapshot"
