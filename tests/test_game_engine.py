"""Unit tests for the SimpleGameEngine helpers."""

from app.models.game import GamePhase, GameState, Player
from app.services.game_engine import SimpleGameEngine


def _build_game_state(phase=GamePhase.BEGIN, turn=1, active_index=0):
    players = [
        Player(id="player1", name="Alice"),
        Player(id="player2", name="Bob"),
    ]
    return GameState(
        id="game-test",
        players=players,
        active_player=active_index,
        phase=phase,
        turn=turn,
    )


def test_record_action_history_enriches_turn_metadata():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.MAIN1, turn=5, active_index=1)
    engine.games[state.id] = state

    engine.record_action_history(
        state.id,
        {
            "action": "test_action",
            "player": "player2",
            "success": True,
        },
    )

    assert len(state.action_history) == 1
    entry = state.action_history[0]
    assert entry["phase"] == GamePhase.MAIN1.value
    assert entry["turn"] == 5
    assert entry["turn_player_id"] == "player2"
    assert entry["turn_player_name"] == "Bob"


def test_record_action_history_preserves_existing_metadata():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.MAIN2, turn=7, active_index=0)
    engine.games[state.id] = state

    engine.record_action_history(
        state.id,
        {
            "action": "custom",
            "player": "player1",
            "success": True,
            "phase": "custom-phase",
            "turn": 42,
            "turn_player_id": "override",
            "turn_player_name": "Override",
        },
    )

    entry = state.action_history[0]
    assert entry["phase"] == "custom-phase"
    assert entry["turn"] == 42
    assert entry["turn_player_id"] == "override"
    assert entry["turn_player_name"] == "Override"


def test_main_phase2_history_entry_after_combat_transition():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.DAMAGE, turn=3, active_index=1)
    engine.games[state.id] = state

    engine._set_phase(state, GamePhase.MAIN2)

    assert len(state.action_history) == 1
    entry = state.action_history[0]
    assert entry["phase"] == GamePhase.MAIN2.value
    assert entry["origin"] == "engine"


def test_end_combat_phase_does_not_duplicate_main_phase_history():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.ATTACK)
    engine.games[state.id] = state

    engine._end_combat_phase(state)
    assert len(state.action_history) == 1
    first_entry = state.action_history[0]
    assert first_entry["phase"] == GamePhase.MAIN2.value

    engine._end_combat_phase(state)
    assert len(state.action_history) == 1


def test_block_phase_history_logged_on_transition():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.ATTACK)
    engine.games[state.id] = state

    engine._transition_to_blockers(state)

    assert len(state.action_history) == 1
    entry = state.action_history[0]
    assert entry["phase"] == GamePhase.BLOCK.value
    assert entry["origin"] == "engine"


def test_damage_phase_history_logged_on_transition():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.BLOCK)
    engine.games[state.id] = state

    engine._transition_to_combat_damage(state)

    assert len(state.action_history) == 1
    entry = state.action_history[0]
    assert entry["phase"] == GamePhase.DAMAGE.value
    assert entry["origin"] == "engine"


def test_remove_pending_phase_history_entry_pops_engine_entry():
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.MAIN1)
    engine.games[state.id] = state

    engine._set_phase(state, GamePhase.ATTACK)
    assert len(state.action_history) == 1

    engine.remove_pending_phase_history_entry(state, GamePhase.ATTACK)
    assert len(state.action_history) == 0
