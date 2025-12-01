"""
Simplified Magic The Gathering game engine for proof of concept.
This will be replaced by XMage integration later.
"""

import random
import asyncio
import uuid
import time
from typing import List, Optional, Dict, Any, Tuple
from app.models.game import (
    Card, Deck, DeckCard, Player, GameState, GameAction,
    GamePhase, CombatState, CombatStep, CardType, GameSetupStatus,
    PlayerDeckStatus, GameFormat, PhaseMode, current_utc_datetime
)

class SimpleGameEngine:
    """Simplified MTG game engine for POC."""

    MAX_ACTION_HISTORY = 10000
    MAX_CHAT_MESSAGES = 1000
    MAX_PLAYER_NAME_LENGTH = 32
    COMBAT_PHASES = {
        GamePhase.ATTACK,
        GamePhase.BLOCK,
        GamePhase.DAMAGE
    }
    
    def __init__(self):
        self.games: dict[str, GameState] = {}
        self.game_setups: dict[str, GameSetupStatus] = {}
        self._pending_decks: dict[str, dict[str, Deck]] = {}
        self.replays: dict[str, List[Dict[str, Any]]] = {}

    def end_game(self, game_id: str) -> bool:
        """End a game and remove it from all tracking dictionaries."""
        found = False
        if game_id in self.games:
            del self.games[game_id]
            found = True
        if game_id in self.game_setups:
            del self.game_setups[game_id]
            found = True
        if game_id in self._pending_decks:
            del self._pending_decks[game_id]
        # Keep replays for export even after game ends
        return found

    @staticmethod
    def _touch_setup(setup: GameSetupStatus) -> None:
        setup.updated_at = current_utc_datetime()

    @staticmethod
    def _touch_game_state(game_state: GameState) -> None:
        game_state.updated_at = current_utc_datetime()

    def _record_replay_step(self, game_id: str, action: Optional[GameAction], game_state: GameState) -> None:
        """Record a step in the game replay timeline."""
        if game_id not in self.replays:
            self.replays[game_id] = []
        
        step = {
            "timestamp": time.time(),
            "state": game_state.model_dump(mode="json")
        }
        if action:
            step["action"] = action.model_dump(mode="json")
        else:
            step["action"] = {"action_type": "initial_setup", "player_id": "system"}
            
        self.replays[game_id].append(step)

    def _set_phase(self, game_state: GameState, new_phase: GamePhase) -> None:
        """Centralized phase setter that manages combat transitions."""
        previous_phase = game_state.phase
        game_state.phase = new_phase
        self._handle_phase_transition(game_state, previous_phase, new_phase)

    def _log_phase_history_entry(
        self,
        game_state: GameState,
        phase: GamePhase,
        player_id: Optional[str] = None
    ) -> None:
        """Insert a synthetic history entry for engine-driven phase transitions."""
        if not game_state or not phase:
            return

        target_player = player_id
        if not target_player and isinstance(game_state.active_player, int):
            if 0 <= game_state.active_player < len(game_state.players):
                target_player = game_state.players[game_state.active_player].id

        entry_player = target_player or "system"
        phase_value = getattr(phase, "value", str(phase))
        entry = {
            "action": "pass_phase",
            "player": entry_player,
            "success": True,
            "phase": phase_value,
            "origin": "engine"
        }

        self.record_action_history(game_state.id, entry)

    def _coerce_phase(self, phase):  # Helper to normalize phase inputs
        if isinstance(phase, GamePhase):
            return phase
        if isinstance(phase, str):
            try:
                return GamePhase(phase)
            except ValueError:
                return None
        return None

    def _is_combat_phase(self, phase) -> bool:
        coerced = self._coerce_phase(phase)
        return coerced in self.COMBAT_PHASES if coerced else False

    def _set_combat_step_for_phase(self, game_state: GameState, phase) -> None:
        if not game_state or not game_state.combat_state:
            return
        coerced = self._coerce_phase(phase)
        combat_state = game_state.combat_state
        if coerced == GamePhase.ATTACK:
            combat_state.step = CombatStep.DECLARE_ATTACKERS
        elif coerced == GamePhase.BLOCK:
            combat_state.step = CombatStep.DECLARE_BLOCKERS
        elif coerced == GamePhase.DAMAGE:
            combat_state.step = CombatStep.COMBAT_DAMAGE
        else:
            combat_state.step = CombatStep.NONE

    def _handle_phase_transition(
        self,
        game_state: GameState,
        previous_phase: GamePhase,
        new_phase: GamePhase
    ) -> None:
        """Handle side-effects when moving between phases."""
        was_combat = self._is_combat_phase(previous_phase)
        now_combat = self._is_combat_phase(new_phase)

        if was_combat and not now_combat:
            self._cleanup_combat_state(game_state)

        if now_combat:
            coerced_new = self._coerce_phase(new_phase)
            if coerced_new == GamePhase.ATTACK and not was_combat:
                self._start_combat_phase(game_state)
            else:
                self._set_combat_step_for_phase(game_state, coerced_new)
        else:
            game_state.combat_state.step = CombatStep.NONE
            game_state.combat_state.expected_player = None

        # Reset end step priority tracking when entering the END phase
        if new_phase == GamePhase.END:
            game_state.end_step_priority_passed = False
            game_state.priority_player = game_state.active_player

    def _start_combat_phase(self, game_state: GameState) -> None:
        """Initialize combat sub-step tracking when entering combat."""
        self._clear_combat_assignments(game_state)

        expected_player = None
        if 0 <= game_state.active_player < len(game_state.players):
            expected_player = game_state.players[game_state.active_player].id

        game_state.combat_state = CombatState(
            step=CombatStep.DECLARE_ATTACKERS,
            attackers_declared=False,
            blockers_declared=False,
            damage_resolved=False,
            expected_player=expected_player,
            pending_attackers=[],
            pending_blockers={}
        )
        game_state.priority_player = game_state.active_player

    def _cleanup_combat_state(self, game_state: GameState) -> None:
        """Reset combat tracking and clear temporary combat assignments."""
        self._clear_combat_assignments(game_state)
        combat_state = game_state.combat_state
        combat_state.step = CombatStep.NONE
        combat_state.attackers_declared = False
        combat_state.blockers_declared = False
        combat_state.damage_resolved = False
        combat_state.expected_player = None
        combat_state.pending_attackers = []
        combat_state.pending_blockers = {}

    def _clear_combat_assignments(self, game_state: GameState) -> None:
        """Clear attacking and blocking flags for all permanents."""
        for player in game_state.players:
            battlefield = getattr(player, "battlefield", [])
            for card in battlefield:
                card.attacking = False
                card.blocking = None

    def _get_defending_player_index(self, game_state: GameState) -> Optional[int]:
        """Return the defending player index for the current combat."""
        if not game_state.players:
            return None
        return (game_state.active_player + 1) % len(game_state.players)

    def _transition_to_blockers(self, game_state: GameState) -> None:
        """Move combat flow to the blocker declaration step."""
        defender_index = self._get_defending_player_index(game_state)
        expected_player = None
        if defender_index is not None and 0 <= defender_index < len(game_state.players):
            expected_player = game_state.players[defender_index].id

        combat_state = game_state.combat_state
        self._set_phase(game_state, GamePhase.BLOCK)
        combat_state.expected_player = expected_player
        combat_state.blockers_declared = False
        combat_state.damage_resolved = False
        combat_state.pending_blockers = {}

        if defender_index is not None:
            game_state.priority_player = defender_index

    def _transition_to_combat_damage(self, game_state: GameState) -> None:
        """Move combat flow to combat damage resolution."""
        combat_state = game_state.combat_state
        self._set_phase(game_state, GamePhase.DAMAGE)
        attacker_id = None
        if 0 <= game_state.active_player < len(game_state.players):
            attacker_id = game_state.players[game_state.active_player].id
        combat_state.expected_player = attacker_id
        game_state.priority_player = game_state.active_player
        combat_state.pending_blockers = {}

    def _end_combat_phase(self, game_state: GameState) -> None:
        """Finish combat and advance to Main Phase 2 if applicable."""
        if self._is_combat_phase(game_state.phase):
            self._set_phase(game_state, GamePhase.MAIN2)
            self._log_phase_history_entry(game_state, GamePhase.MAIN2)
        else:
            self._cleanup_combat_state(game_state)

    def _handle_combat_priority_pass(
        self,
        game_state: GameState,
        action: GameAction
    ) -> None:
        """Advance combat sub-steps when players pass priority."""
        if not self._is_combat_phase(game_state.phase):
            return

        combat_state = game_state.combat_state
        expected_player_id = combat_state.expected_player

        if expected_player_id and action.player_id != expected_player_id:
            expected_index = self._get_player_index(game_state, expected_player_id)
            if expected_index is not None:
                game_state.priority_player = expected_index
            return

        if combat_state.step == CombatStep.DECLARE_ATTACKERS:
            if combat_state.attackers_declared:
                self._transition_to_blockers(game_state)
            else:
                combat_state.attackers_declared = True
                combat_state.blockers_declared = True
                combat_state.damage_resolved = True
                combat_state.step = CombatStep.END_OF_COMBAT
                combat_state.expected_player = None
                self._end_combat_phase(game_state)
        elif combat_state.step == CombatStep.DECLARE_BLOCKERS:
            if not combat_state.blockers_declared:
                combat_state.blockers_declared = True
            self._transition_to_combat_damage(game_state)
        elif combat_state.step == CombatStep.COMBAT_DAMAGE:
            damage_action = GameAction(
                player_id=action.player_id,
                action_type="combat_damage"
            )
            self._resolve_combat_damage(game_state, damage_action)
            combat_state.damage_resolved = True
            combat_state.step = CombatStep.END_OF_COMBAT
            combat_state.expected_player = None
            self._end_combat_phase(game_state)
        elif combat_state.step == CombatStep.END_OF_COMBAT:
            self._end_combat_phase(game_state)
        else:
            game_state.priority_player = game_state.active_player

    def _default_player_name(self, player_id: str) -> str:
        if player_id == "player1":
            return "Player 1"
        if player_id == "player2":
            return "Player 2"
        return "Player"

    def _sanitize_player_name(
        self,
        player_id: str,
        provided_name: Optional[str] = None,
        fallback_name: Optional[str] = None
    ) -> str:
        candidate = provided_name if provided_name is not None else fallback_name
        if candidate is None:
            candidate = self._default_player_name(player_id)
        candidate = str(candidate)
        candidate = "".join(ch for ch in candidate if ch.isprintable())
        candidate = candidate.strip()
        if not candidate:
            candidate = self._default_player_name(player_id)
        if len(candidate) > self.MAX_PLAYER_NAME_LENGTH:
            candidate = candidate[: self.MAX_PLAYER_NAME_LENGTH].rstrip()
        if not candidate:
            candidate = self._default_player_name(player_id)
        return candidate
    
    def create_game_setup(
        self,
        game_id: str,
        game_format: GameFormat = GameFormat.STANDARD,
        phase_mode: PhaseMode = PhaseMode.STRICT
    ) -> GameSetupStatus:
        """
        Create a new game setup (pre-game state before decks are submitted).
        """
        if game_id in self.game_setups:
            existing_setup = self.game_setups[game_id]
            print(f"Game setup {game_id} already exists, returning current status")
            return existing_setup

        setup = GameSetupStatus(
            game_id=game_id,
            game_format=game_format,
            phase_mode=phase_mode,
            status="Waiting for players to join (0/2 seats filled)",
            ready=False,
            player_status={
                "player1": PlayerDeckStatus(submitted=False, validated=False),
                "player2": PlayerDeckStatus(submitted=False, validated=False)
            }
        )
        
        self.game_setups[game_id] = setup
        self._pending_decks[game_id] = {}
        print(
            f"Created game setup for {game_id} with "
            f"format={game_format.value}, phase_mode={phase_mode.value}"
        )
        self._touch_setup(setup)
        return setup
    
    def get_game_setup_status(self, game_id: str) -> Optional[GameSetupStatus]:
        """Get the setup status for a game."""
        return self.game_setups.get(game_id)
    
    def submit_player_deck(
        self, game_id: str, player_id: str, deck: Deck
    ) -> GameSetupStatus:
        """
        Submit a deck for a player during the setup phase.
        Automatically initializes the game when both players have valid decks.
        """
        if game_id not in self.game_setups:
            raise ValueError(f"Game setup {game_id} not found")
        
        setup = self.game_setups[game_id]
        deck.format = setup.game_format
        existing_status = setup.player_status.get(player_id)
        player_alias = self._sanitize_player_name(
            player_id,
            getattr(existing_status, "player_name", None) if existing_status else None
        )
        
        # Validate deck
        main_card_count = sum(dc.quantity for dc in deck.cards)
        commander_count = len(getattr(deck, "commanders", []))
        total_card_count = main_card_count + commander_count

        def _reject_submission(message: str) -> GameSetupStatus:
            setup.player_status[player_id] = PlayerDeckStatus(
                submitted=True,
                validated=False,
                seat_claimed=True,
                deck_name=deck.name,
                player_name=player_alias,
                card_count=total_card_count,
                message=message
            )
            setup.status = f"{player_id} submitted invalid deck"
            self._touch_setup(setup)
            return setup

        if setup.game_format == GameFormat.DUEL_COMMANDER:
            if commander_count == 0:
                return _reject_submission("Commander missing: Duel Commander decks must include exactly one commander.")
            if commander_count > 1:
                return _reject_submission(
                    f"Too many commanders ({commander_count}). Duel Commander decks must include exactly one commander."
                )

        if main_card_count < 40:
            return _reject_submission(
                f"Deck must contain at least 40 main cards (has {main_card_count})."
            )

        # Mark deck as submitted and validated
        setup.player_status[player_id] = PlayerDeckStatus(
            submitted=True,
            validated=True,
            seat_claimed=True,
            deck_name=deck.name,
            player_name=player_alias,
            card_count=total_card_count,
            message="Deck validated successfully"
        )
        
        # Store the deck temporarily
        if game_id not in self._pending_decks:
            self._pending_decks[game_id] = {}
        self._pending_decks[game_id][player_id] = deck
        
        # Check if both players have submitted valid decks
        all_validated = all(
            status.validated 
            for status in setup.player_status.values()
        )
        
        if all_validated:
            # Initialize the actual game
            player1_deck = self._pending_decks.get(game_id, {}).get("player1")
            player2_deck = self._pending_decks.get(game_id, {}).get("player2")
            
            if player1_deck and player2_deck:
                game_state = self._initialize_game_from_setup(
                    game_id, player1_deck, player2_deck, setup
                )
                setup.ready = True
                setup.status = "Game ready - both decks validated"
                print(f"Game {game_id} initialized with both players' decks")
                self._touch_setup(setup)
        else:
            submitted_count = sum(
                1 for status in setup.player_status.values() if status.submitted
            )
            claimed_count = sum(
                1 for status in setup.player_status.values() if status.seat_claimed
            )
            setup.status = f"{claimed_count}/2 seats filled • {submitted_count}/2 decks submitted"
            self._touch_setup(setup)
        
        return setup

    def claim_player_seat(
        self,
        game_id: str,
        player_id: str,
        player_name: Optional[str] = None
    ) -> GameSetupStatus:
        """Claim a seat in the game room without submitting a deck yet."""
        if game_id not in self.game_setups:
            raise ValueError(f"Game setup {game_id} not found")

        if player_id not in {"player1", "player2"}:
            raise ValueError(f"Invalid player seat {player_id}")

        setup = self.game_setups[game_id]
        player_status = setup.player_status.get(player_id)
        if not player_status:
            player_status = PlayerDeckStatus()

        sanitized_name = self._sanitize_player_name(
            player_id,
            player_name,
            getattr(player_status, "player_name", None)
        )
        player_status.player_name = sanitized_name

        if not player_status.seat_claimed:
            player_status.seat_claimed = True
            player_status.message = player_status.message or "Seat claimed. Awaiting deck submission."
            claimed_count = sum(1 for status in setup.player_status.values() if status.seat_claimed)
            submitted_count = sum(1 for status in setup.player_status.values() if status.submitted)
            if not setup.ready:
                setup.status = f"{claimed_count}/2 seats filled • {submitted_count}/2 decks submitted"

        game_state = self.games.get(game_id)
        if game_state:
            for player in game_state.players:
                if player.id == player_id:
                    player.name = sanitized_name
                    break

        setup.player_status[player_id] = player_status
        self._touch_setup(setup)
        return setup
    
    def update_game_settings(
        self,
        game_id: str,
        game_format: Optional[GameFormat] = None,
        phase_mode: Optional[PhaseMode] = None
    ) -> GameSetupStatus:
        """Update game settings before the game starts (before decks are validated)."""
        if game_id not in self.game_setups:
            raise ValueError(f"Game setup {game_id} not found")

        setup = self.game_setups[game_id]
        modified = False
        
        # Don't allow changes after game is ready
        if setup.ready:
            raise ValueError("Cannot change game settings after the game has started")
        
        # Don't allow format changes after decks are submitted
        if game_format and game_format != setup.game_format:
            submitted_any = any(status.submitted for status in setup.player_status.values())
            if submitted_any:
                raise ValueError("Cannot change game format after decks have been submitted")
            setup.game_format = game_format
            modified = True
        
        # Allow phase mode changes any time before game starts
        if phase_mode and phase_mode != setup.phase_mode:
            setup.phase_mode = phase_mode
            modified = True
        
        if modified:
            self._touch_setup(setup)
        
        return setup
    
    def _initialize_game_from_setup(
        self, game_id: str, player1_deck: Deck, player2_deck: Deck,
        setup: GameSetupStatus
    ) -> GameState:
        """Initialize the actual game state from validated decks."""
        player1_id = "player1"
        player2_id = "player2"
        player1_status = setup.player_status.get(player1_id)
        player2_status = setup.player_status.get(player2_id)
        player1_name = self._sanitize_player_name(
            player1_id,
            getattr(player1_status, "player_name", None) if player1_status else None
        )
        player2_name = self._sanitize_player_name(
            player2_id,
            getattr(player2_status, "player_name", None) if player2_status else None
        )

        player1 = Player(
            id=player1_id,
            name=player1_name,
            deck_name=player1_deck.name,
            library=self._shuffle_deck(player1_deck.cards, player1_id)
        )
        player2 = Player(
            id=player2_id,
            name=player2_name,
            deck_name=player2_deck.name,
            library=self._shuffle_deck(player2_deck.cards, player2_id)
        )

        self._initialize_commander_zone(player1, player1_deck)
        self._initialize_commander_zone(player2, player2_deck)
        
        self._draw_cards(player1, 7)
        self._draw_cards(player2, 7)
        
        game_state = GameState(
            id=game_id,
            players=[player1, player2],
            active_player=0,
            phase=GamePhase.BEGIN,
            round=1,
            players_played_this_round=[False, False],
            game_format=setup.game_format,
            phase_mode=setup.phase_mode,
            setup_complete=True,
            deck_status={
                "player1": setup.player_status["player1"],
                "player2": setup.player_status["player2"]
            }
        )
        self._touch_game_state(game_state)
        
        self.games[game_id] = game_state
        self._pending_decks.pop(game_id, None)
        self._log_phase_history_entry(game_state, GamePhase.BEGIN)
        self._record_replay_step(game_id, None, game_state)
        return game_state
    
    def create_game(
        self, game_id: str, player1_deck: Deck, player2_deck: Deck
    ) -> GameState:
        """Create a new game with two players."""
        player1_id = "player1"
        player2_id = "player2"

        player1 = Player(
            id=player1_id,
            name="Player 1",
            library=self._shuffle_deck(player1_deck.cards, player1_id)
        )
        player2 = Player(
            id=player2_id,
            name="Player 2",
            library=self._shuffle_deck(player2_deck.cards, player2_id)
        )
        
        self._draw_cards(player1, 7)
        self._draw_cards(player2, 7)
        
        game_state = GameState(
            id=game_id,
            players=[player1, player2],
            active_player=0,
            phase=GamePhase.BEGIN,
            round=1,
            players_played_this_round=[False, False]
        )
        self._touch_game_state(game_state)
        
        self.games[game_id] = game_state
        self._log_phase_history_entry(game_state, GamePhase.BEGIN)
        self._record_replay_step(game_id, None, game_state)
        return game_state
    
    def create_game_player1(
        self, game_id: str, player1_deck: Deck
    ) -> GameState:
        """Create a new game with only player 1, waiting for player 2."""
        player1_id = "player1"
        player1 = Player(
            id=player1_id,
            name="Player 1",
            library=self._shuffle_deck(player1_deck.cards, player1_id)
        )
        
        self._draw_cards(player1, 7)
        
        game_state = GameState(
            id=game_id,
            players=[player1],
            active_player=0,
            phase=GamePhase.BEGIN
        )
        self._touch_game_state(game_state)
        
        self.games[game_id] = game_state
        self._log_phase_history_entry(game_state, GamePhase.BEGIN)
        self._record_replay_step(game_id, None, game_state)
        return game_state

    def join_game(self, game_id: str, player2_deck: Deck) -> GameState:
        """Join an existing game as player 2."""
        if game_id not in self.games:
            raise ValueError(f"Game {game_id} not found")
        
        game_state = self.games[game_id]
        
        if len(game_state.players) >= 2:
            raise ValueError("Game is already full")
        
        player2_id = "player2"
        player2 = Player(
            id=player2_id,
            name="Player 2",
            library=self._shuffle_deck(player2_deck.cards, player2_id)
        )
        
        self._draw_cards(player2, 7)
        
        game_state.players.append(player2)
        self._touch_game_state(game_state)
        self._record_replay_step(game_id, None, game_state)
        
        return game_state
    
    async def process_action(self, game_id: str, action: GameAction) -> GameState:
        """Process a player action and return updated game state."""
        if game_id not in self.games:
            raise ValueError(f"Game {game_id} not found")

        game_state = self.games[game_id]

        action_map = {
            "play_card": self._play_card,
            "play_card_from_library": self._play_card_from_library,
            "pass_turn": self._pass_turn,
            "pass_phase": self._pass_phase,
            "draw_card": self._draw_card_action,
            "declare_attackers": self._declare_attackers,
            "declare_blockers": self._declare_blockers,
            "preview_attackers": self._preview_attackers,
            "preview_blockers": self._preview_blockers,
            "combat_damage": self._resolve_combat_damage,
            "resolve_stack": self._resolve_stack,
            "resolve_all_stack": self._resolve_all_stack,
            "pass_priority": self._pass_priority,
            "modify_life": self._modify_life,
            "modify_player_counter": self._modify_player_counter,
            "set_player_counter": self._set_player_counter,
            "adjust_commander_tax": self._adjust_commander_tax,
            "tap_card": self._tap_card,
            "change_phase": self._change_phase,
            "shuffle_library": self._shuffle_library,
            "untap_all": self._untap_all,
            "mulligan": self._mulligan,
            "look_top_library": self._look_top_library,
            "reveal_top_library": self._reveal_top_library,
            "target_card": self._target_card,
            "flip_card": self._flip_card,
            "reveal_face_down_card": self._reveal_face_down_card,
            "add_counter": self._add_counter,
            "remove_counter": self._remove_counter,
            "set_counter": self._set_counter,
            "set_power_toughness": self._set_power_toughness,
            "add_custom_keyword": self._add_custom_keyword,
            "remove_custom_keyword": self._remove_custom_keyword,
            "add_custom_type": self._add_custom_type,
            "remove_custom_type": self._remove_custom_type,
            "set_custom_type": self._set_custom_type,
            "search_and_add_card": self._search_and_add_card,
            "create_token": self._create_token,
            "duplicate_card": self._duplicate_card,
            "delete_token": self._delete_token,
            "attach_card": self._attach_card,
            "detach_card": self._detach_card,
        }

        if action.action_type in action_map:
            handler = action_map[action.action_type]
            if asyncio.iscoroutinefunction(handler):
                await handler(game_state, action)
            else:
                handler(game_state, action)
        elif action.action_type == "move_card":
            source_zone = action.additional_data.get("source_zone")
            target_zone = action.additional_data.get("target_zone")
            if not isinstance(source_zone, str) or not isinstance(target_zone, str):
                raise ValueError(
                    "source_zone and target_zone (str) are required for move_card"
                )
            self._move_card(
                game_state,
                action,
                source_zone_name=source_zone,
                destination_zone_name=target_zone
            )
        else:
            raise ValueError(f"Unknown action_type: {action.action_type}")

        self._touch_game_state(game_state)
        self._record_replay_step(game_id, action, game_state)
        return game_state
    
    def record_action_history(self, game_id: str, entry: Dict[str, Any]) -> None:
        """Persist a single action history entry onto the game state."""
        game_state = self.games.get(game_id)
        if not game_state:
            return

        history_entry = dict(entry)
        history_entry.setdefault("timestamp", time.time())
        current_phase = getattr(game_state.phase, "value", game_state.phase)
        if current_phase:
            history_entry.setdefault("phase", current_phase)

        turn_value = getattr(game_state, "turn", None)
        if isinstance(turn_value, int):
            history_entry.setdefault("turn", turn_value)

        active_index = getattr(game_state, "active_player", None)
        players = getattr(game_state, "players", [])
        if (
            isinstance(active_index, int)
            and 0 <= active_index < len(players)
        ):
            active_player = players[active_index]
            history_entry.setdefault("turn_player_id", getattr(active_player, "id", None))
            history_entry.setdefault("turn_player_name", getattr(active_player, "name", None))

        history = game_state.action_history
        history.append(history_entry)
        if len(history) > self.MAX_ACTION_HISTORY:
            history.pop(0)
    
    def add_chat_message(self, game_id: str, message: Dict[str, Any]) -> None:
        """Persist a chat message to the game state's chat log."""
        game_state = self.games.get(game_id)
        if not game_state:
            return

        chat_entry = {
            "player": message.get("player"),
            "message": message.get("message"),
            "timestamp": message.get("timestamp", time.time())
        }

        chat_log = game_state.chat_log
        chat_log.append(chat_entry)
        if len(chat_log) > self.MAX_CHAT_MESSAGES:
            chat_log.pop(0)
    
    def _target_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle targeting or untargeting a card using its persistent unique_id."""
        unique_id = action.additional_data.get("unique_id")
        targeted = action.additional_data.get("targeted")

        if not unique_id:
            raise ValueError("unique_id is required for target_card action")
        if targeted is None:
            raise ValueError("targeted (bool) is required for target_card action")

        for p in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library"]:
                zone = self._get_zone_list(game_state, p, zone_name)
                for card in zone:
                    if card.unique_id == unique_id:
                        card.targeted = targeted
                        action_text = "targeted" if targeted else "untargeted"
                        print(
                            f"Player {action.player_id} {action_text} "
                            f"{card.name} in {zone_name}"
                        )
                        return
        
        for spell in game_state.stack:
            if spell.unique_id == unique_id:
                spell.targeted = targeted
                action_text = "targeted" if targeted else "untargeted"
                print(
                    f"Player {action.player_id} {action_text} "
                    f"{spell.name} on the stack"
                )
                return

        raise ValueError(f"Card with unique_id {unique_id} not found")
    
    def _shuffle_deck(self, deck_cards: List[DeckCard], owner_id: str) -> List[Card]:
        """
        Convert deck list to shuffled list of Card objects with persistent unique IDs
        and owner ID.
        """
        import uuid
        cards = []
        for deck_card in deck_cards:
            for _ in range(deck_card.quantity):
                card_copy = deck_card.card.model_copy(deep=True)
                card_copy.unique_id = uuid.uuid4().hex
                card_copy.owner_id = owner_id
                cards.append(card_copy)
        
        random.shuffle(cards)
        return cards
    
    def _draw_cards(self, player: Player, count: int) -> None:
        """Draw cards from library to hand."""
        for _ in range(min(count, len(player.library))):
            if player.library:
                card = player.library.pop(0)
                self._clear_look_zone_for_card(player, card.unique_id)
                player.hand.append(card)

    def _clear_look_zone_for_card(self, player: Player, unique_id: Optional[str]) -> None:
        """Remove a card from a player's look zone when it leaves the library."""
        if unique_id is None:
            return
        look_zone = getattr(player, "look_zone", None)
        if not look_zone:
            return
        filtered = [card for card in look_zone if card.unique_id != unique_id]
        player.look_zone = filtered
    
    def _initialize_commander_zone(self, player: Player, deck: Deck) -> None:
        """Populate the command zone with designated commanders."""
        commanders = getattr(deck, "commanders", []) or []
        player.commander_zone = []
        player.commander_tax = 0

        if not commanders:
            return

        for commander in commanders:
            if hasattr(commander, "model_copy"):
                commander_copy = commander.model_copy(deep=True)
            else:
                commander_copy = commander.copy(deep=True)  # type: ignore[attr-defined]

            commander_copy.unique_id = uuid.uuid4().hex
            commander_copy.owner_id = player.id
            commander_copy.tapped = False
            commander_copy.targeted = False
            player.commander_zone.append(commander_copy)

        if player.commander_zone:
            names = ", ".join(card.name for card in player.commander_zone)
            print(f"Player {player.id} commander zone initialized with {names}")
    
    def _play_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle playing a card from hand."""
        player = self._get_player(game_state, action.player_id)
        unique_id = action.additional_data.get("unique_id")

        card_to_play = None
        for card in player.hand:
            if card.unique_id == unique_id:
                card_to_play = card
                break
        
        if not card_to_play:
            print(
                f"Card with unique_id {unique_id} not found in hand of "
                f"player {action.player_id}"
            )
            return

        is_land = card_to_play.card_type == CardType.LAND
        is_spell = card_to_play.card_type in [CardType.INSTANT, CardType.SORCERY]

        face_down_requested = bool(action.additional_data.get("face_down"))

        # Face-down cards always go to stack first (treated as creatures)
        if face_down_requested:
            destination_zone = "stack"
        elif game_state.phase_mode == PhaseMode.STRICT and not is_land:
            destination_zone = "stack"
        elif is_spell:
            destination_zone = "stack"
        else:
            destination_zone = "battlefield"

        card_to_play.face_down = face_down_requested
        card_to_play.face_down_owner = action.player_id if face_down_requested else None

        self._move_card(
            game_state,
            action,
            source_zone_name="hand",
            destination_zone_name=destination_zone
        )

    def _play_card_from_library(self, game_state: GameState, action: GameAction) -> None:
        """Handle playing a card from the library."""
        player = self._get_player(game_state, action.player_id)
        unique_id = action.additional_data.get("unique_id")

        card_to_play = None
        for card in player.library:
            if card.unique_id == unique_id:
                card_to_play = card
                break

        if not card_to_play:
            print(
                f"Card with unique_id {unique_id} not found in library of "
                f"player {action.player_id}"
            )
            return

        # For now, assume all cards from library go to battlefield
        destination_zone = "battlefield"

        self._move_card(
            game_state,
            action,
            source_zone_name="library",
            destination_zone_name=destination_zone
        )
    
    def _pass_turn(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing the turn (skips to end of turn)."""
        if self._is_combat_phase(game_state.phase):
            combat_action = GameAction(
                player_id=action.player_id,
                action_type="combat_damage"
            )
            self._resolve_combat_damage(game_state, combat_action)
        
        # Move to END phase first, then handle priority
        if game_state.phase != GamePhase.END:
            self._set_phase(game_state, GamePhase.END)
        
        # Use the end step priority logic
        self._handle_end_step_priority(game_state, action)
    
    def _pass_phase(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing to the next phase (without ending turn)."""
        phases = list(GamePhase)
        current_index = phases.index(game_state.phase)
        
        if current_index < len(phases) - 1:
            next_phase = phases[current_index + 1]
            self._set_phase(game_state, next_phase)
            
            if next_phase == GamePhase.BEGIN:
                active_player = game_state.players[game_state.active_player]
                self._draw_cards(active_player, 1)
        else:
            # We're in END phase - handle priority passing before ending turn
            self._handle_end_step_priority(game_state, action)

    def _handle_end_step_priority(self, game_state: GameState, action: GameAction) -> None:
        """
        Handle priority during the end step.
        Both players must pass priority before moving to the next turn.
        """
        active_player_index = game_state.active_player
        opponent_index = 1 - active_player_index
        action_player_index = self._get_player_index(game_state, action.player_id)

        # If there are spells on the stack, resolve them first
        if game_state.stack:
            return

        # If active player passes priority first, give priority to opponent
        if action_player_index == active_player_index and not game_state.end_step_priority_passed:
            game_state.priority_player = opponent_index
            game_state.end_step_priority_passed = True
            print(f"End step: Active player passed, opponent has priority")
            return

        # Only the opponent can end the turn after active player has passed
        if game_state.end_step_priority_passed and action_player_index == opponent_index:
            self._end_current_turn(game_state)
            return

        # If active player tries to pass again while opponent has priority, ignore
        if game_state.end_step_priority_passed and action_player_index == active_player_index:
            print(f"End step: Active player tried to pass but opponent has priority")
            return
    
    def _end_current_turn(self, game_state: GameState) -> None:
        """End the current turn and move to the next player's turn."""
        current_player_index = game_state.active_player
        game_state.players_played_this_round[current_player_index] = True
        
        if all(game_state.players_played_this_round):
            game_state.turn += 1
            game_state.players_played_this_round = [False, False]
            game_state.round += 1
        
        game_state.active_player = 1 - game_state.active_player
        game_state.end_step_priority_passed = False  # Reset for next turn
        game_state.priority_player = game_state.active_player
        self._set_phase(game_state, GamePhase.BEGIN)
        print(f"Turn ended, now player {game_state.active_player + 1}'s turn")
    
    def _change_phase(self, game_state: GameState, action: GameAction) -> None:
        """Directly change the current game phase."""
        desired_phase = action.additional_data.get("phase")
        if not desired_phase:
            raise ValueError("phase is required for change_phase action")
        
        try:
            target_phase = GamePhase(desired_phase)
        except ValueError as exc:
            raise ValueError(f"Invalid phase value: {desired_phase}") from exc

        self._set_phase(game_state, target_phase)
        print(
            f"Player {action.player_id} manually set phase to {target_phase.value}"
        )

    def _draw_card_action(self, game_state: GameState, action: GameAction) -> None:
        """Handle drawing a card."""
        player = self._get_player(game_state, action.player_id)
        self._draw_cards(player, 1)
        
        # Auto-advance to main phase 1 if in begin phase
        if game_state.phase == GamePhase.BEGIN:
            self._set_phase(game_state, GamePhase.MAIN1)
            self._log_phase_history_entry(game_state, GamePhase.MAIN1)
    
    def _get_player(self, game_state: GameState, player_id: str) -> Player:
        """Get player by ID."""
        for player in game_state.players:
            if player.id == player_id:
                return player
        raise ValueError(f"Player {player_id} not found")
    
    def _has_vigilance(self, card: Card) -> bool:
        """Check if a creature has vigilance."""
        text = (card.text or "").lower()
        return "vigilance" in text
    
    def _declare_attackers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring attacking creatures."""
        if game_state.phase != GamePhase.ATTACK:
            return
        
        attacking_creature_ids = action.additional_data.get(
            "attacking_creatures", []
        )
        attacker_count = len(attacking_creature_ids)
        
        player = self._get_player(game_state, action.player_id)
        
        # First, clear all attacking status for this player
        for card in player.battlefield:
            card.attacking = False
        
        # Then mark new attackers and tap them (unless they have vigilance)
        for unique_id in attacking_creature_ids:
            for card in player.battlefield:
                if card.unique_id == unique_id:
                    card.attacking = True
                    # Tap the creature unless it has vigilance
                    if not self._has_vigilance(card):
                        card.tapped = True
                    print(
                        f"Player {action.player_id} declared {card.name} as attacker "
                        f"(vigilance: {self._has_vigilance(card)})"
                    )
                    break
        
        print(
            f"Player {action.player_id} declared "
            f"{attacker_count} attackers"
        )

        combat_state = game_state.combat_state
        combat_state.pending_attackers = []

        combat_state = game_state.combat_state
        combat_state.attackers_declared = True

        if attacker_count == 0:
            combat_state.blockers_declared = True
            combat_state.damage_resolved = True
            combat_state.step = CombatStep.END_OF_COMBAT
            combat_state.expected_player = None
            print("No attackers declared; advancing to post-combat main phase")
            self._end_combat_phase(game_state)
            return

        self._transition_to_blockers(game_state)
    
    def _declare_blockers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring blocking creatures."""
        if game_state.phase != GamePhase.BLOCK:
            return
        
        blocking_assignments = action.additional_data.get(
            "blocking_assignments", {}
        )
        
        player = self._get_player(game_state, action.player_id)
        
        # First, clear all blocking status for this player
        for card in player.battlefield:
            card.blocking = None
        
        # Then assign blockers to attackers
        # blocking_assignments format: { "blocker_unique_id": "attacker_unique_id" }
        for blocker_id, attacker_id in blocking_assignments.items():
            for card in player.battlefield:
                if card.unique_id == blocker_id:
                    card.blocking = attacker_id
                    print(
                        f"Player {action.player_id} assigned {card.name} "
                        f"to block attacker {attacker_id}"
                    )
                    break
        
        print(
            f"Player {action.player_id} declared "
            f"{len(blocking_assignments)} blockers"
        )

        combat_state = game_state.combat_state
        combat_state.blockers_declared = True
        combat_state.pending_blockers = {}
        self._transition_to_combat_damage(game_state)

    def _preview_attackers(self, game_state: GameState, action: GameAction) -> None:
        """Track the attacking creatures being selected before confirmation."""
        if game_state.phase != GamePhase.ATTACK:
            return

        combat_state = game_state.combat_state
        if combat_state.step != CombatStep.DECLARE_ATTACKERS:
            return

        expected_player = combat_state.expected_player
        if expected_player and action.player_id != expected_player:
            return

        attacking_creature_ids = action.additional_data.get("attacking_creatures", [])
        if not isinstance(attacking_creature_ids, list):
            return

        player = self._get_player(game_state, action.player_id)
        valid_ids = {
            card.unique_id for card in getattr(player, "battlefield", [])
        }
        ordered_unique_ids = []
        for unique_id in attacking_creature_ids:
            if unique_id in valid_ids and unique_id not in ordered_unique_ids:
                ordered_unique_ids.append(unique_id)

        combat_state.pending_attackers = ordered_unique_ids

    def _preview_blockers(self, game_state: GameState, action: GameAction) -> None:
        """Track the blocking assignments before confirmation."""
        if game_state.phase != GamePhase.BLOCK:
            return

        combat_state = game_state.combat_state
        if combat_state.step != CombatStep.DECLARE_BLOCKERS:
            return

        expected_player = combat_state.expected_player
        if expected_player and action.player_id != expected_player:
            return

        blocking_assignments = action.additional_data.get("blocking_assignments", {})
        if not isinstance(blocking_assignments, dict):
            return

        blocker_player = self._get_player(game_state, action.player_id)
        valid_blockers = {
            card.unique_id for card in getattr(blocker_player, "battlefield", [])
        }

        defending_index = self._get_player_index(game_state, action.player_id)
        attacker_index = game_state.active_player
        valid_attackers = set()
        if defending_index is not None:
            opponent_index = (defending_index + 1) % len(game_state.players)
            attacker_index = opponent_index
        if 0 <= attacker_index < len(game_state.players):
            for card in game_state.players[attacker_index].battlefield:
                valid_attackers.add(card.unique_id)

        filtered_assignments: Dict[str, str] = {}
        for blocker_id, attacker_id in blocking_assignments.items():
            if blocker_id in valid_blockers and attacker_id in valid_attackers:
                filtered_assignments[blocker_id] = attacker_id

        combat_state.pending_blockers = filtered_assignments
    
    def _resolve_combat_damage(
        self, game_state: GameState, action: GameAction
    ) -> None:
        """Resolve combat damage."""
        if game_state.phase != GamePhase.DAMAGE:
            return
        
        print("Combat damage resolved")
        self._clear_combat_assignments(game_state)

        combat_state = game_state.combat_state
        combat_state.damage_resolved = True
        combat_state.step = CombatStep.END_OF_COMBAT
        combat_state.expected_player = None
        combat_state.pending_attackers = []
        combat_state.pending_blockers = {}
    
    def _resolve_spell_destination(self, owner: Player, spell: Card) -> str:
        """Move a resolved spell to its appropriate zone and return the zone name."""
        spell.targeted = False

        # Face-down cards always go to battlefield (they're treated as creatures)
        if spell.face_down:
            spell.tapped = False
            owner.battlefield.append(spell)
            return "battlefield"

        if spell.card_type in (CardType.INSTANT, CardType.SORCERY):
            owner.graveyard.append(spell)
            return "graveyard"

        spell.tapped = False
        owner.battlefield.append(spell)
        return "battlefield"

    def _get_player_index(self, game_state: GameState, player_id: str) -> Optional[int]:
        """Return the index of the player with the given ID, or None if not found."""
        for idx, player in enumerate(game_state.players):
            if player.id == player_id:
                return idx
        return None

    def _update_priority_from_stack(self, game_state: GameState) -> None:
        """Update priority based on the top card of the stack."""
        if not game_state.stack:
            game_state.priority_player = game_state.active_player
            return

        top_spell = game_state.stack[-1]
        owner_id = getattr(top_spell, "owner_id", None)

        owner_index = self._get_player_index(game_state, owner_id) if owner_id else None
        if owner_index is None or not game_state.players:
            game_state.priority_player = game_state.active_player
            return

        opponent_index = (owner_index + 1) % len(game_state.players)
        game_state.priority_player = opponent_index

    def _resolve_stack(self, game_state: GameState, action: GameAction) -> None:
        """Resolve the top spell on the stack."""
        if not game_state.stack:
            return

        spell = game_state.stack.pop()

        if not spell.owner_id:
            raise ValueError(
                f"Card {spell.name} ({spell.unique_id}) on stack lacks an owner_id."
            )

        owner = self._get_player(game_state, spell.owner_id)
        destination_zone = self._resolve_spell_destination(owner, spell)

        print(
            f"Resolved {spell.name}, moved to {owner.id}'s {destination_zone}"
        )

        if game_state.stack:
            self._update_priority_from_stack(game_state)
        else:
            game_state.priority_player = game_state.active_player
    
    def _pass_priority(self, game_state: GameState, action: GameAction) -> None:
        """Pass priority to the other player."""
        if game_state.stack:
            self._resolve_stack(game_state, action)
            return

        if self._is_combat_phase(game_state.phase):
            self._handle_combat_priority_pass(game_state, action)
        else:
            game_state.priority_player = game_state.active_player
    
    def _modify_life(self, game_state: GameState, action: GameAction) -> None:
        """Modify a player's life total."""
        target_player_id = action.additional_data.get("target_player")
        amount = action.additional_data.get("amount")
        
        if not target_player_id:
            raise ValueError("target_player is required for modify_life action")
        if amount is None:
            raise ValueError("amount is required for modify_life action")
        
        target_player = None
        for player in game_state.players:
            if player.id == target_player_id:
                target_player = player
                break
        
        if not target_player:
            raise ValueError(f"Player {target_player_id} not found")
        
        old_life = target_player.life
        target_player.life = max(0, target_player.life + amount)
        
        print(
            f"Player {target_player_id} life changed from {old_life} to "
            f"{target_player.life} (amount: {amount})"
        )
    
    def _modify_player_counter(self, game_state: GameState, action: GameAction) -> None:
        """Apply a delta to a player's counter."""
        data = action.additional_data or {}
        target_player_id = data.get("target_player")
        counter_type = data.get("counter_type")
        amount = data.get("amount")

        if not target_player_id:
            raise ValueError("target_player is required for modify_player_counter action")
        if not counter_type:
            raise ValueError("counter_type is required for modify_player_counter action")
        if amount is None:
            raise ValueError("amount is required for modify_player_counter action")

        player = self._get_player(game_state, target_player_id)
        normalized_counter = str(counter_type).strip().lower()
        current_value = player.counters.get(normalized_counter, 0)
        try:
            amount_value = int(amount)
        except (TypeError, ValueError):
            raise ValueError("amount must be an integer for modify_player_counter action")
        new_value = current_value + amount_value
        if new_value <= 0:
            if normalized_counter in player.counters:
                del player.counters[normalized_counter]
        else:
            player.counters[normalized_counter] = new_value

        print(
            f"Player {target_player_id} {normalized_counter} counters changed from "
            f"{current_value} to {player.counters.get(normalized_counter, 0)} "
            f"(delta: {amount_value})"
        )

    def _set_player_counter(self, game_state: GameState, action: GameAction) -> None:
        """Force a player's counter to a specific value."""
        data = action.additional_data or {}
        target_player_id = data.get("target_player")
        counter_type = data.get("counter_type")
        amount = data.get("amount")

        if not target_player_id:
            raise ValueError("target_player is required for set_player_counter action")
        if not counter_type:
            raise ValueError("counter_type is required for set_player_counter action")
        if amount is None:
            raise ValueError("amount is required for set_player_counter action")

        player = self._get_player(game_state, target_player_id)
        normalized_counter = str(counter_type).strip().lower()
        try:
            target_value = int(amount)
        except (TypeError, ValueError):
            raise ValueError("amount must be an integer for set_player_counter action")
        if target_value <= 0:
            player.counters.pop(normalized_counter, None)
        else:
            player.counters[normalized_counter] = target_value

        print(
            f"Player {target_player_id} {normalized_counter} counters set to "
            f"{player.counters.get(normalized_counter, 0)}"
        )
    
    def _adjust_commander_tax(self, game_state: GameState, action: GameAction) -> None:
        """Adjust the commander tax for a specific player."""
        target_player_id = action.additional_data.get("target_player") or action.player_id
        amount = action.additional_data.get("amount")

        if not target_player_id:
            raise ValueError("target_player is required for adjust_commander_tax action")
        if amount is None:
            raise ValueError("amount is required for adjust_commander_tax action")

        target_player = self._get_player(game_state, target_player_id)
        old_tax = getattr(target_player, "commander_tax", 0)
        new_tax = max(0, old_tax + amount)

        target_player.commander_tax = new_tax
        print(
            f"Player {target_player_id} commander tax changed from {old_tax} to "
            f"{new_tax} (amount: {amount})"
        )
    
    def _tap_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle tapping or untapping a card."""
        player = self._get_player(game_state, action.player_id)
        unique_id = action.additional_data.get("unique_id")
        
        if not unique_id:
            raise ValueError("unique_id is required for tap_card action")
        
        desired_tapped_state = action.additional_data.get("tapped")
        
        card_found = None
        for card in player.battlefield:
            if card.unique_id == unique_id:
                card_found = card
                break
        
        if not card_found:
            raise ValueError(
                f"Card with unique_id {unique_id} not found on battlefield "
                f"for player {action.player_id}"
            )
        
        if desired_tapped_state is not None:
            card_found.tapped = desired_tapped_state
        else:
            card_found.tapped = not card_found.tapped
        
        action_text = "tapped" if card_found.tapped else "untapped"
        print(f"Player {action.player_id} {action_text} {card_found.name}")

    def _extract_attachment_chain(
        self, zone_cards: List[Card], host_unique_id: str
    ) -> List[Card]:
        """Remove and return all attachments (recursively) for a given host."""
        collected: List[Card] = []
        index = 0
        while index < len(zone_cards):
            candidate = zone_cards[index]
            if candidate.attached_to == host_unique_id:
                removed = zone_cards.pop(index)
                collected.append(removed)
                collected.extend(self._extract_attachment_chain(zone_cards, removed.unique_id))
                continue
            index += 1
        return collected

    def _normalize_attachment_orders(
        self, zone_cards: List[Card], host_unique_id: str
    ) -> None:
        """Compact attachment_order values for a host based on current battlefield order."""
        order = 0
        for card in zone_cards:
            if card.attached_to == host_unique_id:
                card.attachment_order = order
                order += 1

    def _find_battlefield_card(
        self, game_state: GameState, unique_id: str
    ) -> Optional[Tuple[Player, List[Card], int]]:
        """Return (player, battlefield, index) for a card unique_id if present on any battlefield."""
        if unique_id is None:
            return None
        normalized_id = str(unique_id)
        for player in game_state.players:
            battlefield = self._get_zone_list(game_state, player, "battlefield")
            for idx, card in enumerate(battlefield):
                if str(card.unique_id) == normalized_id:
                    return player, battlefield, idx
        return None

    def _prepare_card_for_destination(
        self, card: Card, destination_zone_name: str
    ) -> None:
        """Clear transient state when a card leaves the battlefield."""
        normalized_destination = self._normalize_zone_name(destination_zone_name)
        if normalized_destination != "battlefield":
            card.attacking = False
            card.blocking = None
            card.attached_to = None
            card.attachment_order = None
            # Only clear face_down when moving to zones other than stack or battlefield
            # Cards on the stack should retain their face_down status
            if normalized_destination != "stack" and getattr(card, "face_down", False):
                card.face_down = False
                card.face_down_owner = None
        if normalized_destination in ["graveyard", "exile", "library", "reveal_zone", "commander_zone"]:
            card.tapped = False
            card.targeted = False
    
    def _move_card(
        self,
        game_state: GameState,
        action: GameAction,
        source_zone_name: str,
        destination_zone_name: str
    ) -> None:
        """
        Moves a card from a source zone to a destination zone for a specific player.
        """
        unique_id = action.additional_data.get("unique_id")
        player_id = action.player_id
        source_player_id = action.additional_data.get("source_player_id") or player_id
        destination_player_id = action.additional_data.get("destination_player_id") or player_id

        if not unique_id:
            raise ValueError(
                f"unique_id is required for moving a card to {destination_zone_name}"
            )

        acting_player_index = self._get_player_index(game_state, player_id)
        if acting_player_index is None:
            raise ValueError(f"Player index for acting player {player_id} not found")

        source_player = self._get_player(game_state, source_player_id)
        destination_player = self._get_player(game_state, destination_player_id)

        source_zone_name = self._normalize_zone_name(source_zone_name)
        destination_zone_name = self._normalize_zone_name(destination_zone_name)
        raw_position_index = action.additional_data.get("position_index")
        position_index = None
        if raw_position_index is not None:
            try:
                position_index = int(raw_position_index)
            except (ValueError, TypeError):
                position_index = None

        card_found = None
        attachments_to_move: List[Card] = []
        source_zone_list = None

        if source_zone_name == "stack":
            for i, spell in enumerate(game_state.stack):
                if spell.unique_id == unique_id:
                    card_found = game_state.stack.pop(i)
                    break
        else:
            source_zone_list = self._get_zone_list(game_state, source_player, source_zone_name)
            for i, card in enumerate(source_zone_list):
                if card.unique_id == unique_id:
                    card_found = source_zone_list.pop(i)
                    break
       
        if not card_found:
            raise ValueError(
                f"Card with unique_id {unique_id} not found in "
                f"{source_zone_name} for player {source_player_id}"
            )

        if source_zone_name == "library":
            self._clear_look_zone_for_card(source_player, unique_id)

        previous_host_id = card_found.attached_to
        if source_zone_name == "battlefield" and source_zone_list is not None:
            attachments_to_move = self._extract_attachment_chain(
                source_zone_list, unique_id
            )

        moved_off_battlefield = source_zone_name == "battlefield"
        if moved_off_battlefield:
            card_found.attacking = False
            card_found.blocking = None
            for attachment in attachments_to_move:
                attachment.attacking = False
                attachment.blocking = None

        owner_locked_zones = {"graveyard", "exile", "library"}
        if destination_zone_name in owner_locked_zones and card_found.owner_id:
            try:
                owner_player = self._get_player(game_state, card_found.owner_id)
                destination_player = owner_player
                destination_player_id = owner_player.id
            except ValueError:
                pass

        # If the host leaves the battlefield, push its attachments to their owners' reveal zones.
        if (
            source_zone_name == "battlefield"
            and destination_zone_name != "battlefield"
            and attachments_to_move
        ):
            for attachment in attachments_to_move:
                attachment_owner_id = attachment.owner_id or action.player_id
                try:
                    reveal_owner = self._get_player(game_state, attachment_owner_id)
                except ValueError:
                    reveal_owner = destination_player
                reveal_zone = self._get_zone_list(
                    game_state,
                    reveal_owner,
                    "reveal_zone"
                )
                self._prepare_card_for_destination(attachment, "reveal_zone")
                reveal_zone.append(attachment)
            attachments_to_move = []

        destination_zone_list = self._get_zone_list(
            game_state, destination_player, destination_zone_name
        )

        if destination_zone_name != "battlefield":
            self._prepare_card_for_destination(card_found, destination_zone_name)
            for attachment in attachments_to_move:
                self._prepare_card_for_destination(attachment, destination_zone_name)

        def insert_card_with_attachments(insert_at: int) -> None:
            destination_zone_list.insert(insert_at, card_found)
            next_index = insert_at + 1
            for attachment in attachments_to_move:
                destination_zone_list.insert(next_index, attachment)
                next_index += 1

        if (
            destination_zone_name == "library" and
            "deck_position" in action.additional_data
        ):
            if action.additional_data["deck_position"] == "bottom":
                insert_card_with_attachments(len(destination_zone_list))
            else:
                insert_card_with_attachments(0)
        elif (
            position_index is not None and
            isinstance(position_index, int) and
            0 <= position_index <= len(destination_zone_list)
        ):
            insert_card_with_attachments(position_index)
        else:
            insert_card_with_attachments(len(destination_zone_list))

        if destination_zone_name == "stack":
            self._update_priority_from_stack(game_state)

        if destination_zone_name == "battlefield" and attachments_to_move:
            self._normalize_attachment_orders(destination_zone_list, card_found.unique_id)

        if previous_host_id and source_zone_name == "battlefield" and source_zone_list is not None:
            self._normalize_attachment_orders(source_zone_list, previous_host_id)

        print(
            f"Card {card_found.name} moved from {source_zone_name} "
            f"(player {source_player_id}) to {destination_zone_name} "
            f"(player {destination_player_id}) by action from {player_id}"
        )

    def _normalize_zone_name(self, zone_name: str) -> str:
        """Normalize zone names to be consistent."""
        if zone_name in ["permanents", "lands", "creatures", "support"]:
            return "battlefield"
        if zone_name == "deck":
            return "library"
        if zone_name in ["reveal", "reveal_zone"]:
            return "reveal_zone"
        if zone_name in ["look", "look_zone"]:
            return "look_zone"
        if zone_name in ["commander", "commander_zone", "command_zone"]:
            return "commander_zone"
        return zone_name

    def _duplicate_card(self, game_state: GameState, action: GameAction) -> None:
        """Duplicate a card on the battlefield for the player who triggered the action."""
        unique_id = action.additional_data.get("unique_id")
        source_zone = action.additional_data.get("source_zone", "battlefield")

        if not unique_id:
            raise ValueError("unique_id is required for duplicate_card action")

        normalized_zone = self._normalize_zone_name(source_zone)
        if normalized_zone != "battlefield":
            raise ValueError("duplicate_card action currently supports battlefield cards only")

        player = self._get_player(game_state, action.player_id)
        zone = self._get_zone_list(game_state, player, normalized_zone)

        original_card = None
        original_index = None
        for idx, card in enumerate(zone):
            if card.unique_id == unique_id:
                original_card = card
                original_index = idx
                break

        if not original_card:
            raise ValueError(
                f"Card with unique_id {unique_id} not found in {normalized_zone} for player {action.player_id}"
            )

        if hasattr(original_card, "model_copy"):
            duplicated_card = original_card.model_copy(deep=True)
        else:
            duplicated_card = original_card.copy(deep=True)  # type: ignore[attr-defined]

        duplicated_card.unique_id = uuid.uuid4().hex
        duplicated_card.tapped = False
        duplicated_card.targeted = False
        duplicated_card.attached_to = None
        duplicated_card.attachment_order = None

        if duplicated_card.counters:
            duplicated_card.counters = dict(duplicated_card.counters)

        insert_at = original_index + 1 if original_index is not None else len(zone)
        zone.insert(insert_at, duplicated_card)

        print(
            f"Player {action.player_id} duplicated {original_card.name} on the battlefield"
        )

    def _attach_card(self, game_state: GameState, action: GameAction) -> None:
        """Attach a battlefield card to a new host."""
        unique_id = action.additional_data.get("unique_id")
        host_unique_id = action.additional_data.get("host_unique_id")
        raw_order = action.additional_data.get("attachment_order")

        if not unique_id:
            raise ValueError("unique_id is required for attach_card action")
        if not host_unique_id:
            raise ValueError("host_unique_id is required for attach_card action")
        if unique_id == host_unique_id:
            raise ValueError("Cannot attach a card to itself")
        unique_id = str(unique_id)
        host_unique_id = str(host_unique_id)

        source_loc = self._find_battlefield_card(game_state, unique_id)
        host_loc = self._find_battlefield_card(game_state, host_unique_id)

        if source_loc is None:
            raise ValueError(f"Card with unique_id {unique_id} not found on any battlefield")
        if host_loc is None:
            raise ValueError(f"Host card with unique_id {host_unique_id} not found on any battlefield")

        source_player, source_battlefield, target_index = source_loc
        host_player, host_battlefield, _ = host_loc

        card_to_attach = source_battlefield.pop(target_index)
        child_attachments = self._extract_attachment_chain(source_battlefield, unique_id)

        # If source and host are the same battlefield, removal might have shifted the host index.
        host_index = next(
            (idx for idx, card in enumerate(host_battlefield) if card.unique_id == host_unique_id),
            None
        )
        if host_index is None:
            raise ValueError(f"Host card with unique_id {host_unique_id} disappeared during attach operation")

        previous_host = card_to_attach.attached_to
        existing_attachments = [card for card in host_battlefield if card.attached_to == host_unique_id]
        resolved_order = len(existing_attachments)
        if raw_order is not None:
            try:
                resolved_order = max(0, min(int(raw_order), len(existing_attachments)))
            except (ValueError, TypeError):
                resolved_order = len(existing_attachments)

        card_to_attach.attached_to = host_unique_id
        card_to_attach.attachment_order = resolved_order

        # Insert after the host's existing attachments up to the resolved order.
        insert_index = host_index + 1
        seen = 0
        while insert_index < len(host_battlefield) and seen < resolved_order:
            if host_battlefield[insert_index].attached_to == host_unique_id:
                seen += 1
            insert_index += 1

        group = [card_to_attach] + child_attachments
        host_battlefield[insert_index:insert_index] = group

        self._normalize_attachment_orders(host_battlefield, host_unique_id)
        if previous_host and previous_host != host_unique_id:
            prev_host_loc = self._find_battlefield_card(game_state, previous_host)
            if prev_host_loc:
                _, prev_battlefield, _ = prev_host_loc
                self._normalize_attachment_orders(prev_battlefield, previous_host)

    def _detach_card(self, game_state: GameState, action: GameAction) -> None:
        """Detach a card from its current host, keeping it on the battlefield."""
        unique_id = action.additional_data.get("unique_id")
        if not unique_id:
            raise ValueError("unique_id is required for detach_card action")
        unique_id = str(unique_id)

        target_loc = self._find_battlefield_card(game_state, unique_id)
        if target_loc is None:
            raise ValueError(f"Card with unique_id {unique_id} not found on any battlefield")

        owner_player, battlefield, target_index = target_loc
        target_card = battlefield[target_index]
        if not target_card:
            raise ValueError(f"Card with unique_id {unique_id} disappeared during detach operation")

        previous_host = target_card.attached_to

        # Remove the card and any attachments that are chained to it.
        removed_card = battlefield.pop(target_index)
        child_attachments = self._extract_attachment_chain(battlefield, unique_id)

        # Clear attachment metadata on the detached card and its attachment chain.
        for card in [removed_card] + child_attachments:
            card.attached_to = None
            card.attachment_order = None

        # Normalize the previous host's attachments on the source battlefield.
        if previous_host:
            self._normalize_attachment_orders(battlefield, previous_host)

        group = [removed_card] + child_attachments

        # Move detached card (and attachments) to the owner's reveal zone, regardless of who detached it.
        owner_id = removed_card.owner_id or action.player_id
        try:
            destination_player = self._get_player(game_state, owner_id)
        except ValueError:
            destination_player = self._get_player(game_state, action.player_id)

        reveal_zone = self._get_zone_list(game_state, destination_player, "reveal_zone")
        reveal_zone.extend(group)

    def _get_zone_list(
        self, game_state: GameState, player: Player, zone_name: str
    ) -> List:
        """Get the list representing a zone."""
        if zone_name == "stack":
            return game_state.stack
        if not hasattr(player, zone_name):
            setattr(player, zone_name, [])
        return getattr(player, zone_name)

    def _shuffle_library(self, game_state: GameState, action: GameAction) -> None:
        """Shuffle a player's library."""
        player = self._get_player(game_state, action.player_id)
        
        random.shuffle(player.library)
        
        print(
            f"Player {action.player_id} shuffled their library "
            f"({len(player.library)} cards)"
        )
    
    def _untap_all(self, game_state: GameState, action: GameAction) -> None:
        """Untap all permanents controlled by a player."""
        player = self._get_player(game_state, action.player_id)
        
        tapped_cards = [card for card in player.battlefield if card.tapped]
        untapped_count = len(tapped_cards)
        
        for card in player.battlefield:
            card.tapped = False
        
        print(
            f"Player {action.player_id} untapped all permanents "
            f"({untapped_count} cards untapped)"
        )

    def _mulligan(self, game_state: GameState, action: GameAction) -> None:
        """Handle mulligan action."""
        player = self._get_player(game_state, action.player_id)
        
        player.library.extend(player.hand)
        player.hand = []
        
        random.shuffle(player.library)
        
        self._draw_cards(player, 7)
        
        print(f"Player {action.player_id} took a mulligan.")

    def _look_top_library(self, game_state: GameState, action: GameAction) -> None:
        """Handle look top library action without removing the card."""
        player = self._get_player(game_state, action.player_id)
        look_zone = self._get_zone_list(game_state, player, "look_zone")
        
        # Find how many cards are already in look zone
        current_count = len(look_zone)
        
        if current_count >= len(player.library):
            print(f"Player {action.player_id} has already looked at all cards in their library.")
            return

        # Get the next card from library (at index = current_count)
        next_card = player.library[current_count]
        look_zone.append(next_card.model_copy(deep=True))

        print(f"Player {action.player_id} looked at {next_card.name} (card #{current_count + 1} from top of library).")

    def _reveal_top_library(self, game_state: GameState, action: GameAction) -> None:
        """Handle reveal top library action by moving the card to the reveal zone."""
        player = self._get_player(game_state, action.player_id)
        if not player.library:
            print(f"Player {action.player_id} attempted to reveal an empty library.")
            return

        top_card = player.library.pop(0)
        reveal_zone = self._get_zone_list(game_state, player, "reveal_zone")
        reveal_zone.append(top_card)
        self._clear_look_zone_for_card(player, top_card.unique_id)

        print(f"Player {action.player_id} revealed {top_card.name} from the top of their library.")

    def _resolve_all_stack(self, game_state: GameState, action: GameAction) -> None:
        """Resolve all spells on the stack."""
        if not game_state.stack:
            print("No spells on the stack to resolve")
            return

        resolved_count = len(game_state.stack)
        print(f"Resolving all {resolved_count} spells on the stack")

        while game_state.stack:
            spell = game_state.stack.pop()

            if not spell.owner_id:
                raise ValueError(
                    f"Card {spell.name} ({spell.unique_id}) on stack lacks an owner_id."
                )

            owner = self._get_player(game_state, spell.owner_id)
            destination_zone = self._resolve_spell_destination(owner, spell)
            print(
                f"Resolved {spell.name}, moved to {owner.id}'s {destination_zone}"
            )

        self._update_priority_from_stack(game_state)
        print(f"All {resolved_count} spells resolved, priority returned to active player")

    def _flip_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle flipping a double-faced card."""
        unique_id = action.additional_data.get("unique_id")

        if not unique_id:
            raise ValueError("unique_id is required for flip_card action")

        # Find the card in all zones and stack
        card_found = None
        for p in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library"]:
                zone = self._get_zone_list(game_state, p, zone_name)
                for card in zone:
                    if card.unique_id == unique_id:
                        card_found = card
                        break
                if card_found:
                    break
            if card_found:
                break

        # Check stack as well
        if not card_found:
            for spell in game_state.stack:
                if spell.unique_id == unique_id:
                    card_found = spell
                    break

        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        # Only flip if it's a double-faced card
        if not card_found.is_double_faced or not card_found.card_faces:
            print(f"Card {card_found.name} is not a double-faced card")
            return

        # Flip to the other face
        if card_found.current_face == 0:
            card_found.current_face = 1
        else:
            card_found.current_face = 0

        # Update card properties from the new face data
        if card_found.current_face < len(card_found.card_faces):
            face_data = card_found.card_faces[card_found.current_face]
            
            # Update card properties with face data
            if "name" in face_data:
                card_found.name = face_data["name"]
            if "mana_cost" in face_data:
                card_found.mana_cost = face_data["mana_cost"]
            if "type_line" in face_data:
                # Parse type_line to update card_type and subtype
                type_line = face_data["type_line"].lower()
                if "land" in type_line:
                    card_found.card_type = CardType.LAND
                elif "creature" in type_line:
                    card_found.card_type = CardType.CREATURE
                elif "instant" in type_line:
                    card_found.card_type = CardType.INSTANT
                elif "sorcery" in type_line:
                    card_found.card_type = CardType.SORCERY
                elif "enchantment" in type_line:
                    card_found.card_type = CardType.ENCHANTMENT
                elif "artifact" in type_line:
                    card_found.card_type = CardType.ARTIFACT
                elif "planeswalker" in type_line:
                    card_found.card_type = CardType.PLANESWALKER
                
                # Update subtype
                if "—" in face_data["type_line"]:
                    card_found.subtype = face_data["type_line"].split("—")[1].strip()
                elif " — " in face_data["type_line"]:
                    card_found.subtype = face_data["type_line"].split(" — ")[1].strip()
            
            if "oracle_text" in face_data:
                card_found.text = face_data["oracle_text"]
            if "power" in face_data:
                card_found.power = face_data["power"]
            if "toughness" in face_data:
                card_found.toughness = face_data["toughness"]
            if "image_url" in face_data:
                card_found.image_url = face_data["image_url"]

        face_name = "back" if card_found.current_face == 1 else "front"
        print(f"Player {action.player_id} flipped {card_found.name} to {face_name} face")

    def _reveal_face_down_card(self, game_state: GameState, action: GameAction) -> None:
        """Reveal a face-down permanent without moving it."""
        unique_id = action.additional_data.get("unique_id")
        if not unique_id:
            raise ValueError("unique_id is required for reveal_face_down_card action")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        if not getattr(card_found, "face_down", False):
            return

        card_found.face_down = False
        card_found.face_down_owner = None
        print(f"Player {action.player_id} revealed {card_found.name} from face-down state")

    def _find_card_by_unique_id(self, game_state: GameState, unique_id: str):
        for player in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library", "reveal_zone"]:
                zone = getattr(player, zone_name, [])
                for card in zone:
                    if card.unique_id == unique_id:
                        return card

        for spell in game_state.stack:
            if spell.unique_id == unique_id:
                return spell

        return None

    def _set_power_toughness(self, game_state: GameState, action: GameAction) -> None:
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        if not unique_id:
            raise ValueError("unique_id is required for set_power_toughness action")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        def normalize_stat(name: str):
            value = data.get(name)
            if value is None:
                return None
            if isinstance(value, str):
                value = value.strip()
            else:
                value = str(value)

            if value == "":
                return None

            if not value.lstrip("-").isdigit():
                raise ValueError(f"{name.capitalize()} must be an integer value")

            return str(int(value))

        def canonical_base(value):
            if value is None:
                return None
            text = str(value).strip()
            if not text:
                return None
            if text.lstrip("-").isdigit():
                return str(int(text))
            return text

        power_value = normalize_stat("power")
        toughness_value = normalize_stat("toughness")

        base_power = canonical_base(card_found.power)
        base_toughness = canonical_base(card_found.toughness)

        if power_value is not None and power_value == base_power:
            power_value = None
        if toughness_value is not None and toughness_value == base_toughness:
            toughness_value = None

        card_found.current_power = power_value
        card_found.current_toughness = toughness_value

    def _add_custom_keyword(self, game_state: GameState, action: GameAction) -> None:
        """Attach a temporary keyword onto a card so it's visible on the board."""
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        keyword = data.get("keyword")

        if not unique_id:
            raise ValueError("unique_id is required for add_custom_keyword action")
        if keyword is None:
            raise ValueError("keyword is required for add_custom_keyword action")

        normalized_keyword = str(keyword).strip()
        if not normalized_keyword:
            raise ValueError("keyword cannot be empty")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        existing_keywords = list(getattr(card_found, "custom_keywords", []) or [])
        lowered = {value.lower() for value in existing_keywords}
        if normalized_keyword.lower() not in lowered:
            existing_keywords.append(normalized_keyword)
            card_found.custom_keywords = existing_keywords
            print(f"Added custom keyword '{normalized_keyword}' to {card_found.name}")

    def _remove_custom_keyword(self, game_state: GameState, action: GameAction) -> None:
        """Remove a previously added keyword from a card."""
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        keyword = data.get("keyword")

        if not unique_id:
            raise ValueError("unique_id is required for remove_custom_keyword action")
        if keyword is None:
            raise ValueError("keyword is required for remove_custom_keyword action")

        normalized_keyword = str(keyword).strip().lower()
        if not normalized_keyword:
            raise ValueError("keyword cannot be empty")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        existing_keywords = list(getattr(card_found, "custom_keywords", []) or [])
        filtered_keywords = [
            value for value in existing_keywords if value.lower() != normalized_keyword
        ]
        card_found.custom_keywords = filtered_keywords
        print(f"Removed custom keyword '{keyword}' from {card_found.name}")

    def _add_custom_type(self, game_state: GameState, action: GameAction) -> None:
        """Append a manual card type override."""
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        custom_type = data.get("card_type")

        if not unique_id:
            raise ValueError("unique_id is required for add_custom_type action")
        if custom_type is None:
            raise ValueError("card_type is required for add_custom_type action")

        normalized_type = str(custom_type).strip().lower()
        if not normalized_type:
            raise ValueError("card_type cannot be empty")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        existing_types = list(getattr(card_found, "custom_types", []) or [])
        lowered = {value.lower() for value in existing_types}
        if normalized_type not in lowered:
            existing_types.append(normalized_type)
            card_found.custom_types = existing_types
            print(f"Added custom type '{normalized_type}' to {card_found.name}")

    def _remove_custom_type(self, game_state: GameState, action: GameAction) -> None:
        """Remove a specific manual card type override."""
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        custom_type = data.get("card_type")

        if not unique_id:
            raise ValueError("unique_id is required for remove_custom_type action")
        if custom_type is None:
            raise ValueError("card_type is required for remove_custom_type action")

        normalized_type = str(custom_type).strip().lower()
        if not normalized_type:
            raise ValueError("card_type cannot be empty")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        existing_types = list(getattr(card_found, "custom_types", []) or [])
        filtered_types = [
            value for value in existing_types if value.lower() != normalized_type
        ]
        card_found.custom_types = filtered_types
        print(f"Removed custom type '{custom_type}' from {card_found.name}")

    def _set_custom_type(self, game_state: GameState, action: GameAction) -> None:
        """Override how a card should be categorized on the battlefield."""
        data = action.additional_data or {}
        unique_id = data.get("unique_id")
        custom_type = data.get("card_type")

        if not unique_id:
            raise ValueError("unique_id is required for set_custom_type action")

        card_found = self._find_card_by_unique_id(game_state, unique_id)
        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        if custom_type is None or custom_type == "":
            card_found.custom_types = []
            print(f"Cleared custom type override for {card_found.name}")
            return

        normalized_type = str(custom_type).strip().lower()
        card_found.custom_types = [normalized_type]
        print(f"Set custom type override for {card_found.name} → {normalized_type}")

    def _add_counter(self, game_state: GameState, action: GameAction) -> None:
        """Add counters to a card."""
        unique_id = action.additional_data.get("unique_id")
        counter_type = action.additional_data.get("counter_type")
        amount = action.additional_data.get("amount", 1)

        if not unique_id:
            raise ValueError("unique_id is required for add_counter action")
        if not counter_type:
            raise ValueError("counter_type is required for add_counter action")

        # Find the card in all zones
        card_found = None
        for p in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library"]:
                zone = self._get_zone_list(game_state, p, zone_name)
                for card in zone:
                    if card.unique_id == unique_id:
                        card_found = card
                        break
                if card_found:
                    break
            if card_found:
                break

        # Check stack as well
        if not card_found:
            for spell in game_state.stack:
                if spell.unique_id == unique_id:
                    card_found = spell
                    break

        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        # Add counters
        if counter_type not in card_found.counters:
            card_found.counters[counter_type] = 0
        card_found.counters[counter_type] += amount

        # Special handling for loyalty counters on planeswalkers
        if counter_type == "loyalty" and card_found.card_type == CardType.PLANESWALKER:
            card_found.loyalty = card_found.counters["loyalty"]

        print(f"Added {amount} {counter_type} counter(s) to {card_found.name}. Total: {card_found.counters[counter_type]}")

    def _remove_counter(self, game_state: GameState, action: GameAction) -> None:
        """Remove counters from a card."""
        unique_id = action.additional_data.get("unique_id")
        counter_type = action.additional_data.get("counter_type")
        amount = action.additional_data.get("amount", 1)

        if not unique_id:
            raise ValueError("unique_id is required for remove_counter action")
        if not counter_type:
            raise ValueError("counter_type is required for remove_counter action")

        # Find the card in all zones
        card_found = None
        for p in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library"]:
                zone = self._get_zone_list(game_state, p, zone_name)
                for card in zone:
                    if card.unique_id == unique_id:
                        card_found = card
                        break
                if card_found:
                    break
            if card_found:
                break

        # Check stack as well
        if not card_found:
            for spell in game_state.stack:
                if spell.unique_id == unique_id:
                    card_found = spell
                    break

        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        # Remove counters
        if counter_type not in card_found.counters:
            card_found.counters[counter_type] = 0

        old_amount = card_found.counters[counter_type]
        card_found.counters[counter_type] = max(0, card_found.counters[counter_type] - amount)
        removed_amount = old_amount - card_found.counters[counter_type]

        # Clean up counter type if it reaches 0
        if card_found.counters[counter_type] == 0:
            del card_found.counters[counter_type]

        # Special handling for loyalty counters on planeswalkers
        if counter_type == "loyalty" and card_found.card_type == CardType.PLANESWALKER:
            card_found.loyalty = card_found.counters.get("loyalty", 0)

        print(f"Removed {removed_amount} {counter_type} counter(s) from {card_found.name}. Total: {card_found.counters.get(counter_type, 0)}")

    def _set_counter(self, game_state: GameState, action: GameAction) -> None:
        """Set the number of counters on a card to a specific amount."""
        unique_id = action.additional_data.get("unique_id")
        counter_type = action.additional_data.get("counter_type")
        amount = action.additional_data.get("amount", 0)

        if not unique_id:
            raise ValueError("unique_id is required for set_counter action")
        if not counter_type:
            raise ValueError("counter_type is required for set_counter action")

        # Find the card in all zones
        card_found = None
        for p in game_state.players:
            for zone_name in ["hand", "battlefield", "graveyard", "exile", "library"]:
                zone = self._get_zone_list(game_state, p, zone_name)
                for card in zone:
                    if card.unique_id == unique_id:
                        card_found = card
                        break
                if card_found:
                    break
            if card_found:
                break

        # Check stack as well
        if not card_found:
            for spell in game_state.stack:
                if spell.unique_id == unique_id:
                    card_found = spell
                    break

        if not card_found:
            raise ValueError(f"Card with unique_id {unique_id} not found")

        # Set counters
        if amount <= 0:
            if counter_type in card_found.counters:
                del card_found.counters[counter_type]
        else:
            card_found.counters[counter_type] = amount

        # Special handling for loyalty counters on planeswalkers
        if counter_type == "loyalty" and card_found.card_type == CardType.PLANESWALKER:
            card_found.loyalty = card_found.counters.get("loyalty", 0)

        print(f"Set {counter_type} counters on {card_found.name} to {amount}")

    async def _search_and_add_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle searching for a card and adding it to the specified zone."""
        from app.services.card_service import CardService
        import uuid

        card_name = action.additional_data.get("card_name")
        target_zone = action.additional_data.get("target_zone")
        is_token = action.additional_data.get("is_token", False)

        if not card_name:
            raise ValueError("card_name is required for search_and_add_card action")
        if not target_zone:
            raise ValueError("target_zone is required for search_and_add_card action")

        player = self._get_player(game_state, action.player_id)

        try:
            card_service = CardService()
            card_data = await card_service.get_card_data_from_scryfall(card_name)

            if not card_data:
                print(f"Card '{card_name}' not found in Scryfall database")
                return
            
            # Create card from Scryfall data
            from app.models.game import Card
            card = Card(**card_data)
            
            # Generate unique ID and set owner
            card.unique_id = uuid.uuid4().hex
            card.owner_id = action.player_id
            
            # Mark as token if requested
            if is_token:
                card.is_token = True
            
            # Add card to the specified zone
            target_zone_list = self._get_zone_list(game_state, player, target_zone)
            target_zone_list.append(card)
            
            print(f"Player {action.player_id} added {card.name} to {target_zone}")
            
        except Exception as e:
            print(f"Error searching and adding card '{card_name}': {e}")

    async def _create_token(self, game_state: GameState, action: GameAction) -> None:
        """Handle creating a token creature by fetching its data from Scryfall."""
        import uuid
        from app.services.card_service import CardService
        from app.models.game import Card

        scryfall_id = action.additional_data.get("scryfall_id")
        if not scryfall_id:
            raise ValueError("scryfall_id is required for create_token action")

        player = self._get_player(game_state, action.player_id)

        try:
            card_service = CardService()
            card_data = await card_service.get_card_data_from_scryfall(scryfall_id, by_id=True)

            if not card_data:
                print(f"Token with Scryfall ID '{scryfall_id}' not found")
                return

            # Create a Card instance from the fetched data
            token = Card(**card_data)

            # Override certain properties for the token instance
            token.unique_id = uuid.uuid4().hex
            token.owner_id = action.player_id
            token.is_token = True

            # Add token to the battlefield
            player.battlefield.append(token)

            print(f"Player {action.player_id} created token: {token.name}")

        except Exception as e:
            print(f"Error creating token with Scryfall ID '{scryfall_id}': {e}")

    def _delete_token(self, game_state: GameState, action: GameAction) -> None:
        """Delete a token permanently from the game state."""
        unique_id = action.additional_data.get("unique_id")
        if not unique_id:
            raise ValueError("unique_id is required for delete_token action")

        def remove_from_collection(collection: List[Card], zone_label: str) -> bool:
            for idx, card in enumerate(collection):
                if card.unique_id == unique_id:
                    if not card.is_token:
                        raise ValueError("Cannot delete a non-token card")
                    removed_card = collection.pop(idx)
                    print(
                        f"Player {action.player_id} deleted token {removed_card.name} from {zone_label}"
                    )
                    return True
            return False

        # Search player zones first for faster removal
        removed = False
        for player in game_state.players:
            for zone_name in ["battlefield", "graveyard", "exile", "hand", "library"]:
                zone = self._get_zone_list(game_state, player, zone_name)
                if remove_from_collection(zone, zone_name):
                    removed = True
                    break

            if removed:
                break

        if not removed:
            if remove_from_collection(game_state.stack, "stack"):
                removed = True

        if not removed:
            raise ValueError(f"Token with unique_id {unique_id} not found")
