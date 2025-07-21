"""
Simplified Magic The Gathering game engine for proof of concept.
This will be replaced by XMage integration later.
"""

import random
from typing import List
from app.models.game import (
    Card, Deck, DeckCard, Player, GameState, GameAction,
    GamePhase, CardType
)


class SimpleGameEngine:
    """Simplified MTG game engine for POC."""
    
    def __init__(self):
        self.games: dict[str, GameState] = {}
    
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
        
        self.games[game_id] = game_state
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
        
        self.games[game_id] = game_state
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
        
        return game_state
    
    def process_action(self, game_id: str, action: GameAction) -> GameState:
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
            "combat_damage": self._resolve_combat_damage,
            "resolve_stack": self._resolve_stack,
            "pass_priority": self._pass_priority,
            "modify_life": self._modify_life,
            "tap_card": self._tap_card,
            "shuffle_library": self._shuffle_library,
            "untap_all": self._untap_all,
            "mulligan": self._mulligan,
            "scry": self._scry,
            "surveil": self._surveil,
            "resolve_temporary_zone": self._resolve_temporary_zone,
            "target_card": self._target_card,
        }
        
        
        if action.action_type in action_map:
            action_map[action.action_type](game_state, action)
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

        return game_state
    
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
                player.hand.append(card)
    
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

        if card_to_play.card_type == CardType.LAND:
            destination_zone = "battlefield"
        elif card_to_play.card_type in [CardType.INSTANT, CardType.SORCERY]:
            destination_zone = "stack"
        else:
            destination_zone = "battlefield"

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
        if game_state.phase == GamePhase.COMBAT:
            combat_action = GameAction(
                player_id=action.player_id,
                action_type="combat_damage"
            )
            self._resolve_combat_damage(game_state, combat_action)
        
        current_player_index = int(action.player_id.replace('player', '')) - 1
        game_state.players_played_this_round[current_player_index] = True
        
        if all(game_state.players_played_this_round):
            game_state.turn += 1
            game_state.players_played_this_round = [False, False]
            game_state.round += 1
        
        game_state.active_player = 1 - game_state.active_player
        game_state.phase = GamePhase.BEGIN
    
    def _pass_phase(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing to the next phase (without ending turn)."""
        phases = list(GamePhase)
        current_index = phases.index(game_state.phase)
        
        if current_index < len(phases) - 1:
            next_phase = phases[current_index + 1]
            game_state.phase = next_phase
            
            if next_phase == GamePhase.BEGIN:
                active_player = game_state.players[game_state.active_player]
                self._draw_cards(active_player, 1)
        else:
            current_player_index = game_state.active_player
            game_state.players_played_this_round[current_player_index] = True
            
            if all(game_state.players_played_this_round):
                game_state.turn += 1
                game_state.players_played_this_round = [False, False]
                game_state.round += 1
            
            game_state.active_player = 1 - game_state.active_player
            game_state.phase = GamePhase.BEGIN
    
    def _draw_card_action(self, game_state: GameState, action: GameAction) -> None:
        """Handle drawing a card."""
        player = self._get_player(game_state, action.player_id)
        self._draw_cards(player, 1)
    
    def _get_player(self, game_state: GameState, player_id: str) -> Player:
        """Get player by ID."""
        for player in game_state.players:
            if player.id == player_id:
                return player
        raise ValueError(f"Player {player_id} not found")
    
    def _declare_attackers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring attacking creatures."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        attacking_creature_ids = action.additional_data.get(
            "attacking_creatures", []
        )
        print(
            f"Player {action.player_id} declared "
            f"{len(attacking_creature_ids)} attackers"
        )
    
    def _declare_blockers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring blocking creatures."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        blocking_assignments = action.additional_data.get(
            "blocking_assignments", {}
        )
        print(
            f"Player {action.player_id} declared "
            f"{len(blocking_assignments)} blockers"
        )
    
    def _resolve_combat_damage(
        self, game_state: GameState, action: GameAction
    ) -> None:
        """Resolve combat damage."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        print("Combat damage resolved")
    
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
        owner.graveyard.append(spell)

        game_state.priority_player = game_state.active_player
    
    def _pass_priority(self, game_state: GameState, action: GameAction) -> None:
        """Pass priority to the other player."""
        if game_state.stack:
            self._resolve_stack(game_state, action)
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

        if not unique_id:
            raise ValueError(
                f"unique_id is required for moving a card to {destination_zone_name}"
            )

        player = self._get_player(game_state, player_id)

        source_zone_name = self._normalize_zone_name(source_zone_name)
        destination_zone_name = self._normalize_zone_name(destination_zone_name)

        card_found = None
        
        if source_zone_name == "stack":
            for i, spell in enumerate(game_state.stack):
                if spell.unique_id == unique_id:
                    card_found = game_state.stack.pop(i)
                    break
        else:
            source_zone_list = self._get_zone_list(
                game_state, player, source_zone_name
            )
            for i, card in enumerate(source_zone_list):
                if card.unique_id == unique_id:
                    card_found = source_zone_list.pop(i)
                    break
        
        if not card_found:
            raise ValueError(
                f"Card with unique_id {unique_id} not found in "
                f"{source_zone_name} for player {player_id}"
            )

        if destination_zone_name == "stack":
            game_state.stack.append(card_found)
            game_state.priority_player = 1 - int(player_id.replace('player', ''))
        else:
            destination_zone_list = self._get_zone_list(
                game_state, player, destination_zone_name
            )
            
            if (
                destination_zone_name == "library" and
                "deck_position" in action.additional_data
            ):
                if action.additional_data["deck_position"] == "bottom":
                    destination_zone_list.append(card_found)
                else:
                    destination_zone_list.insert(0, card_found)
            else:
                destination_zone_list.append(card_found)
        
        print(
            f"Card {card_found.name} moved from {source_zone_name} to "
            f"{destination_zone_name} for player {player_id}"
        )

    def _normalize_zone_name(self, zone_name: str) -> str:
        """Normalize zone names to be consistent."""
        if zone_name in ["permanents", "lands"]:
            return "battlefield"
        if zone_name == "deck":
            return "library"
        return zone_name

    def _get_zone_list(
        self, game_state: GameState, player: Player, zone_name: str
    ) -> List:
        """Get the list representing a zone."""
        if zone_name == "stack":
            return game_state.stack
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

    def _scry(self, game_state: GameState, action: GameAction) -> None:
        """Handle scry action by moving cards to the temporary zone."""
        player = self._get_player(game_state, action.player_id)
        amount = action.additional_data.get("amount", 1)

        scry_cards = player.library[:amount]
        player.library = player.library[amount:]
        player.temporary_zone.extend(scry_cards)

        game_state.pending_action = {
            "player_id": player.id,
            "type": "scry",
            "count": len(scry_cards)
        }
        
        print(f"Player {action.player_id} is scrying {len(scry_cards)} cards.")

    def _surveil(self, game_state: GameState, action: GameAction) -> None:
        """Handle surveil action by moving cards to the temporary zone."""
        player = self._get_player(game_state, action.player_id)
        amount = action.additional_data.get("amount", 1)

        surveil_cards = player.library[:amount]
        player.library = player.library[amount:]
        player.temporary_zone.extend(surveil_cards)

        game_state.pending_action = {
            "player_id": player.id,
            "type": "surveil",
            "count": len(surveil_cards)
        }

        print(
            f"Player {action.player_id} is surveiling {len(surveil_cards)} cards."
        )

    def _resolve_temporary_zone(
        self, game_state: GameState, action: GameAction
    ) -> None:
        """Resolve player decisions for cards in the temporary zone."""
        player = self._get_player(game_state, action.player_id)
        decisions = action.additional_data.get("decisions", [])

        for decision in decisions:
            card_id = decision.get("card_id")
            destination = decision.get("destination")

            card_to_move = None
            for i, card in enumerate(player.temporary_zone):
                if card.id == card_id:
                    card_to_move = player.temporary_zone.pop(i)
                    break
            
            if not card_to_move:
                print(
                    f"Warning: Card {card_id} not found in temporary zone "
                    "for resolution."
                )
                continue

            if destination == "top":
                player.library.insert(0, card_to_move)
            elif destination == "bottom":
                player.library.append(card_to_move)
            elif destination == "graveyard":
                player.graveyard.append(card_to_move)
            else:
                print(
                    f"Warning: Unknown destination '{destination}'. "
                    "Returning card to top of library."
                )
                player.library.insert(0, card_to_move)
        
        if not player.temporary_zone:
            game_state.pending_action = None
        
        print(f"Player {action.player_id} resolved temporary zone actions.")
