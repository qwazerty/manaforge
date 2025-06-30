"""
Simplified Magic The Gathering game engine for proof of concept.
This will be replaced by XMage integration later.
"""

import random
from typing import List, Optional, Dict, Any
from app.models.game import (
    Card, Deck, DeckCard, Player, GameState, GameAction, 
    GamePhase, CardType, Color
)


class SimpleGameEngine:
    """Simplified MTG game engine for POC."""
    
    def __init__(self):
        self.games: Dict[str, GameState] = {}
    
    def create_game(self, game_id: str, player1_deck: Deck, player2_deck: Deck) -> GameState:
        """Create a new game with two players."""
        
        # Create players
        player1 = Player(
            id="player1",
            name="Player 1",
            library=self._shuffle_deck(player1_deck.cards)
        )
        player2 = Player(
            id="player2", 
            name="Player 2",
            library=self._shuffle_deck(player2_deck.cards)
        )
        
        # Initial draw
        self._draw_cards(player1, 7)
        self._draw_cards(player2, 7)
        
        # Create game state
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
    
    def create_game_player1(self, game_id: str, player1_deck: Deck) -> GameState:
        """Create a new game with only player 1, waiting for player 2."""
        
        # Create player 1
        player1 = Player(
            id="player1",
            name="Player 1",
            library=self._shuffle_deck(player1_deck.cards)
        )
        
        # Initial draw for player 1
        self._draw_cards(player1, 7)
        
        # Create game state with only player 1
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
        
        # Check if game is already full
        if len(game_state.players) >= 2:
            raise ValueError("Game is already full")
        
        # Create player 2
        player2 = Player(
            id="player2",
            name="Player 2", 
            library=self._shuffle_deck(player2_deck.cards)
        )
        
        # Initial draw for player 2
        self._draw_cards(player2, 7)
        
        # Add player 2 to the game
        game_state.players.append(player2)
        
        return game_state
    
    def process_action(self, game_id: str, action: GameAction) -> GameState:
        """Process a player action and return updated game state."""
        
        if game_id not in self.games:
            raise ValueError(f"Game {game_id} not found")
        
        game_state = self.games[game_id]
        
        if action.action_type == "play_card":
            self._play_card(game_state, action)
        elif action.action_type == "pass_turn":
            self._pass_turn(game_state, action)
        elif action.action_type == "pass_phase":
            self._pass_phase(game_state, action)
        elif action.action_type == "draw_card":
            self._draw_card_action(game_state, action)
        elif action.action_type == "declare_attackers":
            self._declare_attackers(game_state, action)
        elif action.action_type == "declare_blockers":
            self._declare_blockers(game_state, action)
        elif action.action_type == "combat_damage":
            self._resolve_combat_damage(game_state, action)
        elif action.action_type == "resolve_stack":
            self._resolve_stack(game_state, action)
        elif action.action_type == "pass_priority":
            self._pass_priority(game_state, action)
        elif action.action_type == "modify_life":
            self._modify_life(game_state, action)
        elif action.action_type == "tap_card":
            self._tap_card(game_state, action)
        elif action.action_type == "shuffle_library":
            self._shuffle_library(game_state, action)
        elif action.action_type == "untap_all":
            self._untap_all(game_state, action)
        elif action.action_type == "mulligan":
            self._mulligan(game_state, action)
        elif action.action_type == "scry":
            self._scry(game_state, action)
        elif action.action_type == "surveil":
            self._surveil(game_state, action)
        elif action.action_type == "resolve_temporary_zone":
            self._resolve_temporary_zone(game_state, action)
        elif action.action_type == "move_card":
            source_zone = action.additional_data.get("source_zone")
            target_zone = action.additional_data.get("target_zone")
            if not isinstance(source_zone, str) or not isinstance(target_zone, str):
                raise ValueError("source_zone and target_zone (str) are required for move_card action")
            self._move_card(game_state, action, source_zone_name=source_zone, destination_zone_name=target_zone)

        return game_state
    
    def _shuffle_deck(self, deck_cards: List[DeckCard]) -> List[Card]:
        """Convert deck list to shuffled list of Card objects."""
        import uuid
        cards = []
        for deck_card in deck_cards:
            # Add quantity copies of each card with unique IDs
            for copy_index in range(deck_card.quantity):
                # Create a unique copy of the card with a unique ID
                card_copy = deck_card.card.model_copy()
                card_copy.id = f"{deck_card.card.id}_{uuid.uuid4().hex[:8]}"
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
        # The core logic is now handled by _move_card
        # We set the source_zone to 'hand' and the destination based on card type
        
        player = self._get_player(game_state, action.player_id)
        
        # Find the card in the player's hand to determine its type
        card_to_play = None
        for card in player.hand:
            if card.id == action.card_id or card.name == action.card_id:
                card_to_play = card
                break
        
        if not card_to_play:
            print(f"Card {action.card_id} not found in hand of player {action.player_id}")
            return

        # Determine destination zone based on card type
        if card_to_play.card_type == CardType.LAND:
            destination_zone = "battlefield"
        elif card_to_play.card_type in [CardType.INSTANT, CardType.SORCERY]:
            destination_zone = "stack"
        else: # Creatures, artifacts, enchantments, etc.
            destination_zone = "battlefield"

        # Use the generic move_card function
        self._move_card(
            game_state,
            action,
            source_zone_name="hand",
            destination_zone_name=destination_zone
        )
    
    def _pass_turn(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing the turn (skips to end of turn)."""
        # Special handling for combat phase - auto-resolve combat
        if game_state.phase == GamePhase.COMBAT:
            combat_action = GameAction(
                player_id=action.player_id,
                action_type="combat_damage"
            )
            self._resolve_combat_damage(game_state, combat_action)
        
        # Mark current player as having played this round
        current_player_index = int(action.player_id.replace('player', '')) - 1
        game_state.players_played_this_round[current_player_index] = True
        
        # Check if both players have played this round
        if all(game_state.players_played_this_round):
            # Both players have played, advance to next turn
            game_state.turn += 1
            # Reset players played tracker
            game_state.players_played_this_round = [False, False]
            game_state.round += 1
        
        # Switch to next player
        game_state.active_player = 1 - game_state.active_player
        game_state.phase = GamePhase.BEGIN
    
    def _pass_phase(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing to the next phase (without ending turn)."""
        # Move to next main phase
        phases = list(GamePhase)
        current_index = phases.index(game_state.phase)
        
        if current_index < len(phases) - 1:
            # Go to next phase
            next_phase = phases[current_index + 1]
            game_state.phase = next_phase
            
            # Auto-draw when entering begin phase (unified begin+draw)
            if next_phase == GamePhase.BEGIN:
                active_player = game_state.players[game_state.active_player]
                self._draw_cards(active_player, 1)
        else:
            # At end phase, go to next player's turn
            # Mark current player as having played this round (for _pass_phase)
            current_player_index = game_state.active_player
            game_state.players_played_this_round[current_player_index] = True
            
            # Check if both players have played this round
            if all(game_state.players_played_this_round):
                # Both players have played, advance to next turn
                game_state.turn += 1
                # Reset players played tracker
                game_state.players_played_this_round = [False, False]
                game_state.round += 1
            
            # Switch to next player
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
        
        # Simple implementation - just note that attackers were declared
        attacking_creature_ids = action.additional_data.get("attacking_creatures", [])
        print(f"Player {action.player_id} declared {len(attacking_creature_ids)} attackers")
    
    def _declare_blockers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring blocking creatures."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        # Simple implementation - just note that blockers were declared
        blocking_assignments = action.additional_data.get("blocking_assignments", {})
        print(f"Player {action.player_id} declared {len(blocking_assignments)} blockers")
    
    def _resolve_combat_damage(self, game_state: GameState, action: GameAction) -> None:
        """Resolve combat damage."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        # Simple implementation - no actual damage calculation for now
        print("Combat damage resolved")
    
    def _resolve_stack(self, game_state: GameState, action: GameAction) -> None:
        """Resolve the top spell on the stack."""
        if not game_state.stack:
            return
        
        # Get the top spell from the stack (last added)
        spell = game_state.stack.pop()
        
        # Get the player who cast the spell and the card object
        casting_player = self._get_player(game_state, spell["player_id"])
        card_object = spell.get("card_object")
        
        # Put the spell in the graveyard after resolution
        if card_object:
            casting_player.graveyard.append(card_object)
        
        # For now, spells just resolve without complex effects
        # In a full implementation, this would trigger spell effects
        
        # After resolving, give priority back to the active player
        game_state.priority_player = game_state.active_player
    
    def _pass_priority(self, game_state: GameState, action: GameAction) -> None:
        """Pass priority to the other player."""
        # If both players pass priority and the stack is not empty, resolve the top spell
        current_priority = game_state.priority_player
        other_player = 1 - current_priority
        
        if game_state.stack:
            # If the other player also wants to pass, auto-resolve the stack
            # For now, we'll just resolve the top spell immediately
            self._resolve_stack(game_state, action)
        else:
            # If stack is empty, priority stays with active player
            game_state.priority_player = game_state.active_player
    
    def _modify_life(self, game_state: GameState, action: GameAction) -> None:
        """Modify a player's life total."""
        target_player_id = action.additional_data.get("target_player")
        amount = action.additional_data.get("amount")
        
        if not target_player_id:
            raise ValueError("target_player is required for modify_life action")
        if amount is None:
            raise ValueError("amount is required for modify_life action")
        
        # Find the target player
        target_player = None
        for player in game_state.players:
            if player.id == target_player_id:
                target_player = player
                break
        
        if not target_player:
            raise ValueError(f"Player {target_player_id} not found")
        
        # Modify the life total
        old_life = target_player.life
        target_player.life = max(0, target_player.life + amount)  # Life can't go below 0
        
        print(f"Player {target_player_id} life changed from {old_life} to {target_player.life} (amount: {amount})")
    
    def _tap_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle tapping or untapping a card."""
        player = self._get_player(game_state, action.player_id)
        card_id = action.card_id
        
        if not card_id:
            raise ValueError("card_id is required for tap_card action")
        
        # Get the desired tapped state from additional_data, default to toggle
        desired_tapped_state = action.additional_data.get("tapped")
        
        # Find the card on the battlefield by ID only
        card_found = None
        for card in player.battlefield:
            if card.id == card_id:
                card_found = card
                break
        
        if not card_found:
            raise ValueError(f"Card {card_id} not found on battlefield for player {action.player_id}")
        
        # Set the tapped state
        if desired_tapped_state is not None:
            # Explicit state provided
            card_found.tapped = desired_tapped_state
        else:
            # Toggle the current state
            card_found.tapped = not card_found.tapped
        
        action_text = "tapped" if card_found.tapped else "untapped"
        print(f"Player {action.player_id} {action_text} {card_found.name}")
    
    def _move_card(self, game_state: GameState, action: GameAction, 
                   source_zone_name: str, destination_zone_name: str) -> None:
        """
        Moves a card from a source zone to a destination zone for a specific player.
        This is the new centralized function for all card movements.
        """
        card_id = action.card_id
        player_id = action.player_id

        if not card_id:
            raise ValueError(f"card_id is required for moving a card to {destination_zone_name}")

        player = self._get_player(game_state, player_id)

        # Normalize zone names
        source_zone_name = self._normalize_zone_name(source_zone_name)
        destination_zone_name = self._normalize_zone_name(destination_zone_name)

        # Find and remove the card from the source zone
        card_found = None
        source_zone_list = self._get_zone_list(game_state, player, source_zone_name)
        
        if source_zone_name == "stack":
            # Search in the global stack
            for i, spell in enumerate(game_state.stack):
                if spell.get("card_id") == card_id and spell.get("player_id") == player_id:
                    card_found = game_state.stack.pop(i).get("card_object")
                    break
        else:
            # Search in player's zone
            for i, card in enumerate(source_zone_list):
                if card.id == card_id or card.name == card_id:
                    card_found = source_zone_list.pop(i)
                    break
        
        if not card_found:
            raise ValueError(f"Card {card_id} not found in {source_zone_name} for player {player_id}")

        # Add the card to the destination zone
        if destination_zone_name == "stack":
            spell_on_stack = {
                "name": card_found.name,
                "card_name": card_found.name,
                "card_type": card_found.card_type.value,
                "mana_cost": card_found.mana_cost,
                "text": card_found.text,
                "oracle_text": card_found.text,
                "image_url": card_found.image_url,
                "player_id": player_id,
                "card_id": card_found.id,
                "card_object": card_found,
            }
            game_state.stack.append(spell_on_stack)
            # Give priority to the opponent for responses
            game_state.priority_player = 1 - int(player_id.replace('player', ''))
        else:
            destination_zone_list = self._get_zone_list(game_state, player, destination_zone_name)
            
            # Handle deck position
            if destination_zone_name == "library" and "deck_position" in action.additional_data:
                if action.additional_data["deck_position"] == "bottom":
                    destination_zone_list.append(card_found)
                else: # Default to top
                    destination_zone_list.insert(0, card_found)
            else:
                destination_zone_list.append(card_found)
        
        print(f"Card {card_found.name} moved from {source_zone_name} to {destination_zone_name} for player {player_id}")

    def _normalize_zone_name(self, zone_name: str) -> str:
        """Normalize zone names to be consistent."""
        if zone_name in ["permanents", "lands"]:
            return "battlefield"
        if zone_name == "deck":
            return "library"
        return zone_name

    def _get_zone_list(self, game_state: GameState, player: Player, zone_name: str) -> List:
        """Get the list representing a zone."""
        if zone_name == "stack":
            return game_state.stack
        return getattr(player, zone_name)

    def _shuffle_library(self, game_state: GameState, action: GameAction) -> None:
        """Shuffle a player's library."""
        player = self._get_player(game_state, action.player_id)
        
        # Shuffle the player's library
        random.shuffle(player.library)
        
        print(f"Player {action.player_id} shuffled their library ({len(player.library)} cards)")
    
    def _untap_all(self, game_state: GameState, action: GameAction) -> None:
        """Untap all permanents controlled by a player."""
        player = self._get_player(game_state, action.player_id)
        
        # Count how many cards will be untapped
        tapped_cards = [card for card in player.battlefield if card.tapped]
        untapped_count = len(tapped_cards)
        
        # Untap all cards on the battlefield
        for card in player.battlefield:
            card.tapped = False
        
        print(f"Player {action.player_id} untapped all permanents ({untapped_count} cards untapped)")

    def _mulligan(self, game_state: GameState, action: GameAction) -> None:
        """Handle mulligan action."""
        player = self._get_player(game_state, action.player_id)
        
        # Return hand to library
        player.library.extend(player.hand)
        player.hand = []
        
        # Shuffle library
        random.shuffle(player.library)
        
        # Draw new hand of 7 cards
        self._draw_cards(player, 7)
        
        print(f"Player {action.player_id} took a mulligan.")

    def _scry(self, game_state: GameState, action: GameAction) -> None:
        """Handle scry action by moving cards to the temporary zone for player decision."""
        player = self._get_player(game_state, action.player_id)
        amount = action.additional_data.get("amount", 1)

        scry_cards = player.library[:amount]
        player.library = player.library[amount:]
        player.temporary_zone.extend(scry_cards)

        # Add a flag to the game state to indicate a scry action is pending resolution
        game_state.pending_action = {
            "player_id": player.id,
            "type": "scry",
            "count": len(scry_cards)
        }
        
        print(f"Player {action.player_id} is scrying {len(scry_cards)} cards.")

    def _surveil(self, game_state: GameState, action: GameAction) -> None:
        """Handle surveil action by moving cards to the temporary zone for player decision."""
        player = self._get_player(game_state, action.player_id)
        amount = action.additional_data.get("amount", 1)

        surveil_cards = player.library[:amount]
        player.library = player.library[amount:]
        player.temporary_zone.extend(surveil_cards)

        # Add a flag to the game state to indicate a surveil action is pending
        game_state.pending_action = {
            "player_id": player.id,
            "type": "surveil",
            "count": len(surveil_cards)
        }

        print(f"Player {action.player_id} is surveiling {len(surveil_cards)} cards.")

    def _resolve_temporary_zone(self, game_state: GameState, action: GameAction) -> None:
        """Resolve player decisions for cards in the temporary zone (from scry/surveil)."""
        player = self._get_player(game_state, action.player_id)
        decisions = action.additional_data.get("decisions", []) # e.g., [{"card_id": "xyz", "destination": "top"}]

        for decision in decisions:
            card_id = decision.get("card_id")
            destination = decision.get("destination")

            card_to_move = None
            for i, card in enumerate(player.temporary_zone):
                if card.id == card_id:
                    card_to_move = player.temporary_zone.pop(i)
                    break
            
            if not card_to_move:
                print(f"Warning: Card {card_id} not found in temporary zone for resolution.")
                continue

            if destination == "top":
                player.library.insert(0, card_to_move)
            elif destination == "bottom":
                player.library.append(card_to_move)
            elif destination == "graveyard":
                player.graveyard.append(card_to_move)
            else:
                # Default case or error: return to top of library
                print(f"Warning: Unknown destination '{destination}'. Returning card to top of library.")
                player.library.insert(0, card_to_move)
        
        # If temporary zone is empty, clear the pending action
        if not player.temporary_zone:
            game_state.pending_action = None
        
        print(f"Player {action.player_id} resolved temporary zone actions.")
