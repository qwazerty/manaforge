"""
Engine for managing draft rooms and the drafting process.
"""

import copy
import uuid
import random
import re
from typing import Dict, List, Optional, Any

from app.models.game import (
    DraftRoom,
    DraftPlayer,
    Card,
    DraftState,
    DraftType,
    CubeConfiguration,
)
from app.services.draft_service import DraftService


class DraftEngine:
    """Manages draft rooms and the drafting process."""

    MAX_PLAYER_NAME_LENGTH = 32

    def __init__(self, draft_service: DraftService):
        self.draft_service = draft_service
        self.draft_rooms: Dict[str, DraftRoom] = {}
        self.cube_card_pools: Dict[str, List[str]] = {}
        self.cube_pool_cursor: Dict[str, int] = {}
        self.cube_card_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

    async def create_draft_room(
        self,
        name: str,
        set_code: str,
        set_name: str,
        max_players: int,
        creator_id: str,
        cube_settings: Optional[Dict[str, Any]] = None,
        draft_type: DraftType = DraftType.BOOSTER_DRAFT,
    ) -> DraftRoom:
        """Creates a new draft room and adds the creator as Player 1."""
        room_id = f"draft-{uuid.uuid4().hex[:8]}"
        cube_settings = cube_settings or {}
        cube_configuration: Optional[CubeConfiguration] = None
        normalized_set_code = (set_code or "").strip()
        normalized_set_name = (set_name or "").strip()
        resolved_draft_type = draft_type

        if cube_settings.get("use_cube") or resolved_draft_type == DraftType.CUBE:
            cube_payload = await self.draft_service.load_cube_pool(
                source_url=cube_settings.get("cube_url"),
                raw_list=cube_settings.get("cube_list"),
                preferred_name=cube_settings.get("cube_name")
                or normalized_set_name
                or name,
            )
            card_pool = cube_payload.get("card_pool") or []
            if len(card_pool) < 15:
                raise ValueError("Cube list must contain at least 15 cards.")
            random.shuffle(card_pool)
            self.cube_card_pools[room_id] = card_pool
            self.cube_pool_cursor[room_id] = 0
            self.cube_card_cache[room_id] = {}
            cube_configuration = CubeConfiguration(
                cube_id=cube_payload.get("cube_id"),
                source_url=cube_payload.get("source_url"),
                name=cube_payload.get("cube_name"),
                card_count=cube_payload.get("card_count", len(card_pool)),
            )
            normalized_set_name = (
                cube_configuration.name or normalized_set_name or "Custom Cube"
            )
            normalized_set_code = (
                cube_payload.get("set_code") or cube_configuration.cube_id or "cube"
            )
            resolved_draft_type = DraftType.CUBE
        else:
            if not normalized_set_code:
                raise ValueError(
                    "Set code is required for sealed pools and booster drafts."
                )
            if resolved_draft_type == DraftType.CUBE:
                resolved_draft_type = DraftType.BOOSTER_DRAFT
            if resolved_draft_type not in {DraftType.BOOSTER_DRAFT, DraftType.SEALED}:
                resolved_draft_type = DraftType.BOOSTER_DRAFT

        room = DraftRoom(
            id=room_id,
            name=name,
            set_code=normalized_set_code,
            set_name=normalized_set_name or normalized_set_code.upper(),
            max_players=max_players,
            draft_type=resolved_draft_type,
            cube_configuration=cube_configuration,
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

        player = DraftPlayer(
            id=player_id, name=""
        )  # Name will be set by _update_player_names
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
        bot = DraftPlayer(
            id=bot_id, name="", is_bot=True
        )  # Name will be set by _update_player_names
        room.players.append(bot)
        random.shuffle(room.players)
        self._update_player_names(room)
        return bot

    def _update_player_names(self, room: DraftRoom):
        """
        Ensure every player has a name without overwriting existing ones.
        New humans/bots get the next default number; renamed players stay intact.
        """
        human_count = 0
        bot_count = 0

        for player in room.players:
            if player.is_bot:
                if player.name:
                    match = re.match(r"Bot\s+(\d+)$", player.name.strip())
                    if match:
                        bot_count = max(bot_count, int(match.group(1)))
                continue

            if player.name:
                match = re.match(r"Player\s+(\d+)$", player.name.strip())
                if match:
                    human_count = max(human_count, int(match.group(1)))

        human_count += 1
        bot_count += 1

        for player in room.players:
            if player.name:
                continue
            if player.is_bot:
                player.name = f"Bot {bot_count}"
                bot_count += 1
            else:
                player.name = f"Player {human_count}"
                human_count += 1

    def _sanitize_player_name(
        self, provided_name: Optional[str], fallback_name: Optional[str]
    ) -> str:
        candidate = (
            provided_name if provided_name is not None else fallback_name or "Player"
        )
        candidate = "".join(ch for ch in str(candidate) if ch.isprintable())
        candidate = candidate.strip()
        if not candidate:
            candidate = fallback_name or "Player"
        if len(candidate) > self.MAX_PLAYER_NAME_LENGTH:
            candidate = candidate[: self.MAX_PLAYER_NAME_LENGTH].rstrip()
        if not candidate:
            candidate = fallback_name or "Player"
        return candidate

    def rename_player(self, room_id: str, player_id: str, new_name: str) -> DraftPlayer:
        room = self.get_draft_room(room_id)
        if not room:
            raise ValueError("Draft room not found.")
        player = next((p for p in room.players if p.id == player_id), None)
        if not player:
            raise ValueError("Player not found in this room.")
        if player.is_bot:
            raise ValueError("Bots cannot be renamed.")
        sanitized = self._sanitize_player_name(new_name, player.name)
        if not sanitized:
            raise ValueError("Player name cannot be empty.")
        player.name = sanitized
        return player

    def fill_bots(self, room_id: str):
        """Fills the room with bots up to max_players."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        while len(room.players) < room.max_players:
            self.add_bot_to_room(room_id)

    async def start_draft(self, room_id: str):
        """Starts the draft for a room. Idempotent - does nothing if already started."""
        room = self.get_draft_room(room_id)
        if not room:
            return

        # Idempotent: if draft already started or completed, do nothing
        if room.state != DraftState.WAITING:
            return

        room.state = DraftState.DRAFTING

        if room.draft_type == DraftType.SEALED:
            room.current_pack_number = 0
            room.current_pick_number = 0
            room.packs = []
            for player in room.players:
                player.current_pack = []
                player.drafted_cards = await self._generate_sealed_pool(
                    room.set_code, boosters=6
                )
                player.has_picked_card = False
            room.state = DraftState.COMPLETED
            return

        # Generate 3 packs for each player
        packs_per_player = 3
        room.packs = []
        for _ in room.players:
            player_packs = []
            for _ in range(packs_per_player):
                if room.draft_type == DraftType.CUBE:
                    pack = await self._generate_cube_pack(room.id, 15)
                else:
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

        card_to_pick = next(
            (c for c in player.current_pack if c.unique_id == card_unique_id), None
        )
        if not card_to_pick:
            return False

        player.drafted_cards.append(card_to_pick)
        player.current_pack.remove(card_to_pick)
        player.has_picked_card = True

        # The target pack size for all players after this round of picks
        target_pack_size = len(player.current_pack)

        # Check if all human players have now made their pick
        human_players = [p for p in room.players if not p.is_bot]
        all_humans_picked = all(
            len(p.current_pack) == target_pack_size for p in human_players
        )

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
            if (
                player.is_bot
                and player.current_pack
                and len(player.current_pack) > target_pack_size
            ):
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

        current_packs = [p.current_pack for p in room.players]

        if room.pack_direction == 1:  # Pass left
            new_packs = [current_packs[-1]] + current_packs[:-1]
        else:  # Pass right
            new_packs = current_packs[1:] + [current_packs[0]]

        for i, player in enumerate(room.players):
            player.current_pack = new_packs[i]
            player.has_picked_card = False

        room.current_pick_number += 1

    async def _generate_sealed_pool(
        self, set_code: str, boosters: int = 6
    ) -> List[Card]:
        """Generate a sealed pool worth of boosters."""
        pool: List[Card] = []
        total_boosters = max(1, boosters)
        for _ in range(total_boosters):
            pack = await self.draft_service.generate_booster(set_code)
            pool.extend(pack)
        return pool

    async def _generate_cube_pack(self, room_id: str, size: int) -> List[Card]:
        """Draw a pack of cards from the cube pool."""
        card_pool = self.cube_card_pools.get(room_id)
        if not card_pool:
            return []

        cursor = self.cube_pool_cursor.get(room_id, 0)
        pack: List[Card] = []
        attempts = 0
        max_attempts = len(card_pool) + size
        while len(pack) < size and attempts < max_attempts:
            if cursor >= len(card_pool):
                random.shuffle(card_pool)
                cursor = 0

            card_name = card_pool[cursor]
            cursor += 1
            card = await self._resolve_cube_card(room_id, card_name)
            if card:
                pack.append(card)
            attempts += 1

        self.cube_pool_cursor[room_id] = cursor
        return pack

    async def _resolve_cube_card(self, room_id: str, card_name: str) -> Optional[Card]:
        """Fetch or reuse a card template for cubes."""
        if not card_name:
            return None

        cache = self.cube_card_cache.setdefault(room_id, {})
        cache_key = card_name.lower()
        template = cache.get(cache_key)

        if not template:
            card_obj = await self.draft_service.card_service.get_card_by_name(card_name)
            if not card_obj:
                return None
            template = card_obj.model_dump(mode="json")
            template.pop("unique_id", None)
            template.pop("owner_id", None)
            cache[cache_key] = template

        card_data = copy.deepcopy(template)
        return Card(**card_data)
