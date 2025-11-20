"""Unit tests for the SimpleGameEngine helpers."""

from app.models.game import Card, CardType, GameAction, GamePhase, GameState, Player
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
        text=""
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
        additional_data={"unique_id": card.unique_id, "keyword": "Flying"}
    )
    engine._add_custom_keyword(state, action)
    assert card.custom_keywords == ["Flying"]

    duplicate_action = GameAction(
        player_id="player1",
        action_type="add_custom_keyword",
        additional_data={"unique_id": card.unique_id, "keyword": "flying"}
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
        additional_data={"unique_id": card.unique_id, "keyword": "FLYING"}
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
        additional_data={"unique_id": card.unique_id, "card_type": "creature"}
    )
    engine._add_custom_type(state, action)
    assert card.custom_types == ["creature"]

    duplicate = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "CREATURE"}
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
        additional_data={"unique_id": card.unique_id, "card_type": "LAND"}
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
        additional_data={"unique_id": card.unique_id, "card_type": "creature"}
    )
    engine._add_custom_type(state, add_action)
    assert card.custom_types == ["creature"]

    second_action = GameAction(
        player_id="player1",
        action_type="add_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "land"}
    )
    engine._add_custom_type(state, second_action)
    assert card.custom_types == ["creature", "land"]

    # Remove a single type
    remove_action = GameAction(
        player_id="player1",
        action_type="remove_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": "CREATURE"}
    )
    engine._remove_custom_type(state, remove_action)
    assert card.custom_types == ["land"]

    # Clear all using legacy setter for reset operations
    clear_action = GameAction(
        player_id="player1",
        action_type="set_custom_type",
        additional_data={"unique_id": card.unique_id, "card_type": None}
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
            "target_zone": "graveyard"
        }
    )

    engine._move_card(state, action, "battlefield", "graveyard")

    assert any(card.unique_id == host.unique_id for card in state.players[0].graveyard)
    assert not any(
        card.unique_id in {aura.unique_id, stolen_equipment.unique_id}
        for card in state.players[0].graveyard
    )
    assert all(card.unique_id != host.unique_id for card in state.players[0].battlefield)

    assert any(card.unique_id == aura.unique_id for card in state.players[0].reveal_zone)
    assert any(
        card.unique_id == stolen_equipment.unique_id
        for card in state.players[1].reveal_zone
    )
    assert all(card.attached_to is None for card in state.players[0].reveal_zone + state.players[1].reveal_zone)
