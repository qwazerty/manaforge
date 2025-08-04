"""
Engine for managing draft rooms and the drafting process.
"""
import uuid
import random
from typing import Dict, List, Optional

from app.models.game import DraftRoom, DraftPlayer, Card, DraftState
from app.services.draft_service import DraftService

class DraftEngine:
    """Manages draft rooms and the drafting process."""

    def __init__(self, draft_service: DraftService):
        self.draft_service = draft_service
        self.draft_rooms: Dict[str, DraftRoom] = {}

    def create_draft_room(self, name: str, set_code: str, set_name: str, max_players: int, creator_id: str) -> DraftRoom:
        """Creates a new draft room and adds the creator as Player 1."""
        room_id = f"draft-{uuid.uuid4().hex[:8]}"
        room = DraftRoom(
            id=room_id,
            name=name,
            set_code=set_code,
            set_name=set_name,
            max_players=max_players,
        )

        # Add the creator as the first player
        creator_player = DraftPlayer(id=creator_id, name="Player 1")
        room.players.append(creator_player)

        self.draft_rooms[room_id] = room
        return room

    def get_draft_room(self, room_id: str) -> Optional[DraftRoom]:
        """Retrieves a draft room by its ID."""
        return self.draft_rooms.get(room_id)

    def add_player_to_room(self, room_id: str, player_id: str) -> Optional[DraftPlayer]:
        """Adds a player to a draft room."""
        room = self.get_draft_room(room_id)
        if not room or len(room.players) >= room.max_players:
            return None

        # Check if player is already in the room
        if any(p.id == player_id for p in room.players):
            return next((p for p in room.players if p.id == player_id), None)

        player = DraftPlayer(id=player_id, name="")  # Name will be set by _update_player_names
        room.players.append(player)
        random.shuffle(room.players)
        self._update_player_names(room)
        return player

    def add_bot_to_room(self, room_id: str) -> Optional[DraftPlayer]:
        """Adds a bot to a draft room."""
        room = self.get_draft_room(room_id)
        if not room or len(room.players) >= room.max_players:
            return None

        bot_id = f"bot-{uuid.uuid4().hex[:8]}"
        bot = DraftPlayer(id=bot_id, name="", is_bot=True)  # Name will be set by _update_player_names
        room.players.append(bot)
        random.shuffle(room.players)
        self._update_player_names(room)
        return bot

    def _update_player_names(self, room: DraftRoom):
        """Re-assigns player and bot names based on their current order in the list."""
        human_player_count = 1
        bot_count = 1
        for player in room.players:
            if player.is_bot:
                player.name = f"Bot {bot_count}"
                bot_count += 1
            else:
                player.name = f"Player {human_player_count}"
                human_player_count += 1

    def fill_bots(self, room_id: str):
        """Fills the room with bots up to max_players."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        while len(room.players) < room.max_players:
            self.add_bot_to_room(room_id)

    async def start_draft(self, room_id: str):
        """Starts the draft for a room."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        room.state = DraftState.DRAFTING
        
        # Generate 3 packs for each player
        packs_per_player = 3
        room.packs = []
        for _ in room.players:
            player_packs = []
            for _ in range(packs_per_player):
                pack = await self.draft_service.generate_booster(room.set_code)
                player_packs.append(pack)
            room.packs.append(player_packs)

        # Distribute the first pack to each player
        for i, player in enumerate(room.players):
            player.current_pack = room.packs[i][0]

    def pick_card(self, room_id: str, player_id: str, card_unique_id: str) -> bool:
        """Handles a player picking a card from their current pack."""
        room = self.get_draft_room(room_id)
        if not room or room.state != DraftState.DRAFTING:
            return False

        player = next((p for p in room.players if p.id == player_id), None)
        if not player:
            return False

        card_to_pick = next((c for c in player.current_pack if c.unique_id == card_unique_id), None)
        if not card_to_pick:
            return False

        player.drafted_cards.append(card_to_pick)
        player.current_pack.remove(card_to_pick)
        player.has_picked_card = True
        
        # The target pack size for all players after this round of picks
        target_pack_size = len(player.current_pack)

        # Check if all human players have now made their pick
        human_players = [p for p in room.players if not p.is_bot]
        all_humans_picked = all(len(p.current_pack) == target_pack_size for p in human_players)

        if all_humans_picked:
            # If all humans are done, bots make their picks
            self._bots_pick_cards(room_id, target_pack_size)

        # Check if all players (humans and bots) have completed their pick
        # This is the condition to pass the packs
        if all(len(p.current_pack) == target_pack_size for p in room.players):
            self._pass_packs(room_id)

        return True

    def _bots_pick_cards(self, room_id: str, target_pack_size: int):
        """Makes all bots in a room pick a card if they haven't already."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        for player in room.players:
            # A bot should pick if it's a bot, has a pack, and its pack is larger than the target size
            if player.is_bot and player.current_pack and len(player.current_pack) > target_pack_size:
                # Simple bot logic: pick a random card
                card_to_pick = random.choice(player.current_pack)
                player.drafted_cards.append(card_to_pick)
                player.current_pack.remove(card_to_pick)

    def _pass_packs(self, room_id: str):
        """Passes the packs to the next player."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        if not any(p.current_pack for p in room.players):
            # All packs are empty, start the next round
            room.current_pack_number += 1
            room.current_pick_number = 1
            room.pack_direction *= -1  # Change direction for next pack

            if room.current_pack_number > 3:
                room.state = DraftState.COMPLETED
                return
            else:
                # Distribute the next pack
                for i, player in enumerate(room.players):
                    player.current_pack = room.packs[i][room.current_pack_number - 1]
                    player.has_picked_card = False
                return

        num_players = len(room.players)
        current_packs = [p.current_pack for p in room.players]
        
        if room.pack_direction == 1:  # Pass left
            new_packs = [current_packs[-1]] + current_packs[:-1]
        else:  # Pass right
            new_packs = current_packs[1:] + [current_packs[0]]

        for i, player in enumerate(room.players):
            player.current_pack = new_packs[i]
            player.has_picked_card = False
            
        room.current_pick_number += 1
