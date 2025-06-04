"""
Simplified Magic The Gathering game engine for proof of concept.
This will be replaced by XMage integration later.
"""

import random
from typing import List, Optional, Dict, Any
from app.models.game import (
    Card, Deck, Player, GameState, GameAction, 
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
            phase=GamePhase.UNTAP
        )
        
        self.games[game_id] = game_state
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
        
        return game_state
    
    def _shuffle_deck(self, deck_cards: List[Dict[str, Any]]) -> List[Card]:
        """Convert deck list to shuffled list of Card objects."""
        cards = []
        for deck_card in deck_cards:
            card_data = deck_card["card"]
            quantity = deck_card.get("quantity", 1)
            
            for _ in range(quantity):
                card = Card(**card_data)
                cards.append(card)
        
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
        
        # For simplicity, just move card to battlefield
        if card_to_play.card_type == CardType.CREATURE:
            player.battlefield.append(card_to_play)
        else:
            # Non-permanents go to graveyard after resolving
            player.graveyard.append(card_to_play)
    
    def _pass_turn(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing the turn."""
        # Special handling for combat phase
        if game_state.phase == GamePhase.COMBAT:
            # Auto-resolve combat damage if in combat phase
            combat_action = GameAction(
                player_id=action.player_id,
                action_type="combat_damage"
            )
            self._resolve_combat_damage(game_state, combat_action)
        
        # Move to next phase or next player
        if game_state.phase == GamePhase.CLEANUP:
            # Next player's turn
            game_state.active_player = 1 - game_state.active_player
            game_state.phase = GamePhase.UNTAP
            game_state.turn += 1
            
            # Draw card for new turn
            active_player = game_state.players[game_state.active_player]
            self._draw_cards(active_player, 1)
        else:
            # Next phase
            phases = list(GamePhase)
            current_index = phases.index(game_state.phase)
            if current_index < len(phases) - 1:
                game_state.phase = phases[current_index + 1]
    
    def _pass_phase(self, game_state: GameState, action: GameAction) -> None:
        """Handle passing to the next phase (without ending turn)."""
        # Move to next phase
        phases = list(GamePhase)
        current_index = phases.index(game_state.phase)
        
        if current_index < len(phases) - 1:
            # Go to next phase
            game_state.phase = phases[current_index + 1]
        else:
            # At cleanup phase, go to next player's turn
            game_state.active_player = 1 - game_state.active_player
            game_state.phase = GamePhase.UNTAP
            game_state.turn += 1
            
            # Draw card for new turn
            active_player = game_state.players[game_state.active_player]
            self._draw_cards(active_player, 1)
    
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
        
        player = self._get_player(game_state, action.player_id)
        attacking_creature_ids = action.additional_data.get("attacking_creatures", [])
        
        # Mark creatures as attacking (in a real implementation, track combat state)
        for creature in player.battlefield:
            if creature.id in attacking_creature_ids:
                # Add attacking status - for now we'll use additional_data
                if not hasattr(creature, 'combat_state'):
                    creature.combat_state = {}
                creature.combat_state['attacking'] = True
    
    def _declare_blockers(self, game_state: GameState, action: GameAction) -> None:
        """Handle declaring blocking creatures."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        defending_player = self._get_player(game_state, action.player_id)
        blocking_assignments = action.additional_data.get("blocking_assignments", {})
        
        # blocking_assignments: {"blocker_id": "attacker_id"}
        for blocker_id, attacker_id in blocking_assignments.items():
            # Find blocker in defending player's battlefield
            for creature in defending_player.battlefield:
                if creature.id == blocker_id:
                    if not hasattr(creature, 'combat_state'):
                        creature.combat_state = {}
                    creature.combat_state['blocking'] = attacker_id
    
    def _resolve_combat_damage(self, game_state: GameState, action: GameAction) -> None:
        """Resolve combat damage."""
        if game_state.phase != GamePhase.COMBAT:
            return
        
        attacking_player = game_state.players[game_state.active_player]
        defending_player = game_state.players[1 - game_state.active_player]
        
        # Track creatures to remove (died in combat)
        creatures_to_remove = []
        damage_to_player = 0
        
        # Process each attacking creature
        for attacker in attacking_player.battlefield:
            if hasattr(attacker, 'combat_state') and attacker.combat_state.get('attacking'):
                attacker_power = attacker.power or 0
                is_blocked = False
                
                # Check if this attacker is blocked
                for blocker in defending_player.battlefield:
                    if (hasattr(blocker, 'combat_state') and 
                        blocker.combat_state.get('blocking') == attacker.id):
                        is_blocked = True
                        blocker_power = blocker.power or 0
                        blocker_toughness = blocker.toughness or 1
                        attacker_toughness = attacker.toughness or 1
                        
                        # Combat damage - creatures deal damage to each other
                        if attacker_power >= blocker_toughness:
                            creatures_to_remove.append((defending_player, blocker))
                        
                        if blocker_power >= attacker_toughness:
                            creatures_to_remove.append((attacking_player, attacker))
                        
                        break
                
                # If unblocked, damage goes to defending player
                if not is_blocked:
                    damage_to_player += attacker_power
        
        # Apply damage to defending player
        defending_player.life -= damage_to_player
        
        # Remove destroyed creatures
        for player, creature in creatures_to_remove:
            if creature in player.battlefield:
                player.battlefield.remove(creature)
                player.graveyard.append(creature)
        
        # Clear combat state
        for player in game_state.players:
            for creature in player.battlefield:
                if hasattr(creature, 'combat_state'):
                    delattr(creature, 'combat_state')
