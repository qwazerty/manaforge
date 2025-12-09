"""Unit tests for the SimpleGameEngine helpers."""

from app.backend.models.game import (
    Card,
    CardType,
    GameAction,
    GamePhase,
    GameState,
    Player,
)
from app.backend.services.game_engine import SimpleGameEngine


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


def _build_card(unique_id="card-001", card_type=CardType.LAND):
    return Card(
        id="card-test",
        unique_id=unique_id,
        owner_id="player1",
        name="Test Card",
        mana_cost="",
        cmc=0,
        card_type=card_type,
        subtype="",
        text="",
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


def test_add_custom_keyword_adds_only_unique_entries():
    engine = SimpleGameEngine()
    state = _build_game_state()
    card = _build_card()
    state.players[0].battlefield.append(card)

    action = GameAction(
        player_id="player1",
        action_type="add_custom_keyword",
        additional_data={"unique_id": card.unique_id, "keyword": "Flying"},
    )
    engine._add_custom_keyword(state, action)
    assert card.custom_keywords == ["Flying"]

    duplicate_action = GameAction(
        player_id="player1",
        action_type="add_custom_keyword",
        additional_data={"unique_id": card.unique_id, "keyword": "flying"},
    )
    engine._add_custom_keyword(state, duplicate_action)
    assert card.custom_keywords == ["Flying"]


def test_remove_custom_keyword_is_case_insensitive():
    engine = SimpleGameEngine()
    state = _build_game_state()
    card = _build_card()
    card.custom_keywords = ["Flying", "Haste"]
    state.players[0].battlefield.append(card)

    action = GameAction(
        player_id="player1",
        action_type="remove_custom_keyword",
        additional_data={"unique_id": card.unique_id, "keyword": "FLYING"},
    )
    engine._remove_custom_keyword(state, action)
    assert card.custom_keywords == ["Haste"]


def test_add_custom_type_ignores_duplicates():
    engine = SimpleGameEngine()
    state = _build_game_state()
    card = _build_card()
    state.players[0].battlefield.append(card)

    action = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "creature"},
    )
    engine._add_custom_type(state, action)
    assert card.custom_types == ["creature"]

    duplicate = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "CREATURE"},
    )
    engine._add_custom_type(state, duplicate)
    assert card.custom_types == ["creature"]


def test_remove_custom_type_is_case_insensitive():
    engine = SimpleGameEngine()
    state = _build_game_state()
    card = _build_card()
    card.custom_types = ["creature", "land"]
    state.players[0].battlefield.append(card)

    action = GameAction(
        player_id="player1",
        action_type="remove_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "LAND"},
    )
    engine._remove_custom_type(state, action)
    assert card.custom_types == ["creature"]


def test_set_custom_type_override_and_clear():
    engine = SimpleGameEngine()
    state = _build_game_state()
    card = _build_card(card_type=CardType.LAND)
    state.players[0].battlefield.append(card)

    # Use add/remove helpers for richer interactions
    add_action = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "creature"},
    )
    engine._add_custom_type(state, add_action)
    assert card.custom_types == ["creature"]

    second_action = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "land"},
    )
    engine._add_custom_type(state, second_action)
    assert card.custom_types == ["creature", "land"]

    # Remove a single type
    remove_action = GameAction(
        player_id="player1",
        action_type="remove_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "CREATURE"},
    )
    engine._remove_custom_type(state, remove_action)
    assert card.custom_types == ["land"]

    # Clear all using legacy setter for reset operations
    clear_action = GameAction(
        player_id="player1",
        action_type="set_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": None},
    )
    engine._set_custom_type(state, clear_action)
    assert card.custom_types == []


def test_move_card_sends_attachments_to_owner_reveal_zone():
    engine = SimpleGameEngine()
    state = _build_game_state()

    host = _build_card(unique_id="host-card", card_type=CardType.CREATURE)
    host.owner_id = "player1"
    aura = _build_card(unique_id="aura-card", card_type=CardType.ENCHANTMENT)
    aura.owner_id = "player1"
    aura.attached_to = host.unique_id
    stolen_equipment = _build_card(unique_id="equip-card", card_type=CardType.ARTIFACT)
    stolen_equipment.owner_id = "player2"
    stolen_equipment.attached_to = host.unique_id

    state.players[0].battlefield.extend([host, aura, stolen_equipment])

    action = GameAction(
        player_id="player1",
        action_type="move_card",
        additional_data={
            "unique_id": host.unique_id,
            "source_zone": "battlefield",
            "target_zone": "graveyard",
        },
    )

    engine._move_card(state, action, "battlefield", "graveyard")

    assert any(card.unique_id == host.unique_id for card in state.players[0].graveyard)
    assert not any(
        card.unique_id in {aura.unique_id, stolen_equipment.unique_id}
        for card in state.players[0].graveyard
    )
    assert all(
        card.unique_id != host.unique_id for card in state.players[0].battlefield
    )

    assert any(
        card.unique_id == aura.unique_id for card in state.players[0].reveal_zone
    )
    assert any(
        card.unique_id == stolen_equipment.unique_id
        for card in state.players[1].reveal_zone
    )
    assert all(
        card.attached_to is None
        for card in state.players[0].reveal_zone + state.players[1].reveal_zone
    )


def test_end_step_priority_passing():
    """Test that both players must pass priority during the end step."""
    engine = SimpleGameEngine()
    state = _build_game_state(phase=GamePhase.END, active_index=0)
    engine.games[state.id] = state

    # Initially, active player should have priority
    assert state.priority_player == 0
    assert not state.end_step_priority_passed

    # Active player (player1) passes priority
    action1 = GameAction(player_id="player1", action_type="pass_phase")
    engine._pass_phase(state, action1)

    # After active player passes, opponent should have priority
    assert state.priority_player == 1
    assert state.end_step_priority_passed

    # Opponent (player2) resolves end step (confirms turn end)
    action2 = GameAction(player_id="player2", action_type="pass_phase")
    engine._pass_phase(state, action2)

    # After opponent confirms, turn should end
    assert state.active_player == 1  # Now player2's turn
    assert state.phase == GamePhase.BEGIN
    assert not state.end_step_priority_passed  # Reset for next turn


def test_restart_game_reuses_submitted_decks():
    """Test that restart_game correctly reuses the originally submitted decks."""
    from app.backend.models.game import (
        Deck,
        DeckCard,
        Card,
        CardType,
        GameFormat,
        PhaseMode,
    )

    engine = SimpleGameEngine()
    game_id = "test-restart"

    # Create a game setup
    setup = engine.create_game_setup(
        game_id=game_id, game_format=GameFormat.STANDARD, phase_mode=PhaseMode.STRICT
    )
    assert setup.game_id == game_id

    # Create minimal decks with proper Card objects
    def make_deck_cards(prefix: str, count: int):
        return [
            DeckCard(
                card=Card(
                    id=f"{prefix}-{i}",
                    unique_id=f"{prefix}-{i}",
                    owner_id="",
                    name=f"{prefix} Card {i}",
                    mana_cost="",
                    cmc=0,
                    card_type=CardType.LAND,
                    subtype="",
                    text="",
                ),
                quantity=1,
            )
            for i in range(count)
        ]

    deck1 = Deck(name="Test Deck 1", cards=make_deck_cards("d1", 60))
    deck2 = Deck(name="Test Deck 2", cards=make_deck_cards("d2", 60))

    # Submit both decks
    engine.submit_player_deck(game_id, "player1", deck1)
    engine.submit_player_deck(game_id, "player2", deck2)

    # Verify game was initialized
    assert game_id in engine.games
    original_state = engine.games[game_id]

    # Simulate some game progress
    original_state.turn = 5

    # Restart the game
    new_state = engine.restart_game(game_id)

    # Verify the game was reset
    assert new_state.turn == 0
    assert new_state.phase == GamePhase.PREGAME
    assert len(new_state.players) == 2
    assert new_state.players[0].name == "Player 1"
    assert new_state.players[1].name == "Player 2"

    # Verify decks are preserved
    assert game_id in engine._submitted_decks
    assert "player1" in engine._submitted_decks[game_id]
    assert "player2" in engine._submitted_decks[game_id]


def test_restart_game_fails_without_setup():
    """Test that restart_game raises an error when game setup doesn't exist."""
    engine = SimpleGameEngine()

    try:
        engine.restart_game("nonexistent-game")
        assert False, "Expected ValueError"
    except ValueError as e:
        assert "not found" in str(e).lower()


def test_restart_game_fails_without_submitted_decks():
    """Test that restart_game raises an error when decks weren't submitted."""
    from app.backend.models.game import GameFormat, PhaseMode

    engine = SimpleGameEngine()
    game_id = "test-no-decks"

    # Create setup but don't submit decks
    engine.create_game_setup(
        game_id=game_id, game_format=GameFormat.STANDARD, phase_mode=PhaseMode.STRICT
    )

    try:
        engine.restart_game(game_id)
        assert False, "Expected ValueError"
    except ValueError as e:
        assert "not available" in str(e).lower() or "decks" in str(e).lower()
