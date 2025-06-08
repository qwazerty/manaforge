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
            phase=GamePhase.UNTAP,
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
            phase=GamePhase.UNTAP
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
        
        return game_state
    
    def _shuffle_deck(self, deck_cards: List[DeckCard]) -> List[Card]:
        """Convert deck list to shuffled list of Card objects."""
        cards = []
        for deck_card in deck_cards:
            # Add quantity copies of each card
            for _ in range(deck_card.quantity):
                cards.append(deck_card.card)
        
        random.shuffle(cards)
        return cards
    
    def _draw_cards(self, player: Player, count: int) -> None:
        """Draw cards from library to hand."""
        for _ in range(min(count, len(player.library))):
            if player.library:
                card = player.library.pop(0)
                player.hand.append(card)
    
    def _play_card(self, game_state: GameState, action: GameAction) -> None:
        """Handle playing a card."""
        player = self._get_player(game_state, action.player_id)
        
        # Find card in hand
        card_to_play = None
        for i, card in enumerate(player.hand):
            if card.id == action.card_id:
                card_to_play = player.hand.pop(i)
                break
        
        if not card_to_play:
            return
        
        # Lands go directly to battlefield (no stack)
        if card_to_play.card_type == CardType.LAND:
            player.battlefield.append(card_to_play)
        # Instants and sorceries go to the stack
        elif card_to_play.card_type in [CardType.INSTANT, CardType.SORCERY]:
            spell_on_stack = {
                "name": card_to_play.name,
                "card_name": card_to_play.name,
                "card_type": card_to_play.card_type.value,
                "mana_cost": card_to_play.mana_cost,
                "text": card_to_play.text,
                "oracle_text": card_to_play.text,
                "image_url": card_to_play.image_url,  # Include image URL for stack display
                "player_id": action.player_id,
                "card_id": card_to_play.id,
                "card_object": card_to_play  # Store the full card for later resolution
            }
            game_state.stack.append(spell_on_stack)
            # Give priority to the opponent for responses
            game_state.priority_player = 1 - int(action.player_id.replace('player', ''))
        # Other permanents (creatures, artifacts, enchantments, planeswalkers) go to battlefield
        else:
            player.battlefield.append(card_to_play)
    
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
        game_state.phase = GamePhase.UNTAP
        
        # Draw card for new turn
        active_player = game_state.players[game_state.active_player]
        self._draw_cards(active_player, 1)
    
    def _pass_phase(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing to the next phase (without ending turn)."""
        # Move to next main phase
        phases = list(GamePhase)
        current_index = phases.index(game_state.phase)
        
        if current_index < len(phases) - 1:
            # Go to next phase
            next_phase = phases[current_index + 1]
            game_state.phase = next_phase
            
            # Auto-draw when entering upkeep phase (merged upkeep+draw)
            if next_phase == GamePhase.UPKEEP:
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
            game_state.phase = GamePhase.UNTAP
    
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
