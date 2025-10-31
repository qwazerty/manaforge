"""
Simplified Magic The Gathering game engine for proof of concept.
This will be replaced by XMage integration later.
"""

import random
import asyncio
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
            "combat_damage": self._resolve_combat_damage,
            "resolve_stack": self._resolve_stack,
            "resolve_all_stack": self._resolve_all_stack,
            "pass_priority": self._pass_priority,
            "modify_life": self._modify_life,
            "tap_card": self._tap_card,
            "change_phase": self._change_phase,
            "shuffle_library": self._shuffle_library,
            "untap_all": self._untap_all,
            "mulligan": self._mulligan,
            "scry": self._scry,
            "surveil": self._surveil,
            "resolve_temporary_zone": self._resolve_temporary_zone,
            "target_card": self._target_card,
            "flip_card": self._flip_card,
            "add_counter": self._add_counter,
            "remove_counter": self._remove_counter,
            "set_counter": self._set_counter,
            "search_and_add_card": self._search_and_add_card,
            "create_token": self._create_token,
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
    
    def _change_phase(self, game_state: GameState, action: GameAction) -> None:
        """Directly change the current game phase."""
        desired_phase = action.additional_data.get("phase")
        if not desired_phase:
            raise ValueError("phase is required for change_phase action")
        
        try:
            target_phase = GamePhase(desired_phase)
        except ValueError as exc:
            raise ValueError(f"Invalid phase value: {desired_phase}") from exc

        game_state.phase = target_phase
        print(
            f"Player {action.player_id} manually set phase to {target_phase.value}"
        )

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
        raw_position_index = action.additional_data.get("position_index")
        position_index = None
        if raw_position_index is not None:
            try:
                position_index = int(raw_position_index)
            except (ValueError, TypeError):
                position_index = None

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
            elif (
                position_index is not None and
                isinstance(position_index, int) and
                0 <= position_index <= len(destination_zone_list)
            ):
                destination_zone_list.insert(position_index, card_found)
            else:
                destination_zone_list.append(card_found)
        
        print(
            f"Card {card_found.name} moved from {source_zone_name} to "
            f"{destination_zone_name} for player {player_id}"
        )

    def _normalize_zone_name(self, zone_name: str) -> str:
        """Normalize zone names to be consistent."""
        if zone_name in ["permanents", "lands", "creatures", "support"]:
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
            owner.graveyard.append(spell)
            print(f"Resolved {spell.name}, moved to {spell.owner_id}'s graveyard")

        game_state.priority_player = game_state.active_player
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
