"""
Core models for the Magic The Gathering game.
"""

from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from enum import Enum


def current_utc_datetime() -> datetime:
    """Return current time with UTC timezone info."""
    return datetime.now(timezone.utc)


class CardType(str, Enum):
    """Card types in Magic The Gathering."""

    CREATURE = "creature"
    INSTANT = "instant"
    SORCERY = "sorcery"
    ENCHANTMENT = "enchantment"
    ARTIFACT = "artifact"
    PLANESWALKER = "planeswalker"
    LAND = "land"


class Rarity(str, Enum):
    """Card rarities."""

    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    MYTHIC = "mythic"


class Color(str, Enum):
    """Magic colors."""

    WHITE = "W"
    BLUE = "U"
    BLACK = "B"
    RED = "R"
    GREEN = "G"


class Card(BaseModel):
    """A Magic The Gathering card."""

    id: str = Field(..., description="Unique card identifier")
    scryfall_id: Optional[str] = Field(
        default=None, description="Scryfall's unique ID for this card"
    )
    unique_id: str = Field(
        default_factory=lambda: f"card_{uuid.uuid4().hex}",
        description="Unique instance identifier for a card in a game",
    )
    owner_id: Optional[str] = Field(
        default=None, description="ID of the player who owns this card instance"
    )
    name: str = Field(..., description="Card name")
    mana_cost: str = Field(default="", description="Mana cost (e.g., '2RG')")
    cmc: int = Field(default=0, description="Converted mana cost")
    card_type: CardType = Field(..., description="Primary card type")
    subtype: str = Field(default="", description="Card subtype")
    text: str = Field(default="", description="Card text/abilities")
    power: Optional[int | str] = Field(default=None, description="Creature power")
    toughness: Optional[int | str] = Field(
        default=None, description="Creature toughness"
    )
    current_power: Optional[str] = Field(
        default=None, description="Current overridden power"
    )
    current_toughness: Optional[str] = Field(
        default=None, description="Current overridden toughness"
    )
    colors: List[Color] = Field(default_factory=list, description="Card colors")
    rarity: Rarity = Field(default=Rarity.COMMON, description="Card rarity")
    image_url: Optional[str] = Field(default=None, description="Card image URL")
    tapped: bool = Field(default=False, description="Whether the card is tapped")
    targeted: bool = Field(default=False, description="Whether the card is targeted")
    # Combat support
    attacking: bool = Field(
        default=False, description="Whether the creature is currently attacking"
    )
    blocking: Optional[str] = Field(
        default=None, description="Unique ID of the attacker this creature is blocking"
    )
    attached_to: Optional[str] = Field(
        default=None,
        description="Unique ID of the host card this permanent is attached to",
    )
    attachment_order: Optional[int] = Field(
        default=None, description="Ordering index among attachments on the host card"
    )
    custom_keywords: List[str] = Field(
        default_factory=list,
        description="Player-added keywords displayed directly on the card overlay",
    )
    custom_types: List[str] = Field(
        default_factory=list,
        description="Manual card type overrides that influence battlefield grouping",
    )
    is_commander: bool = Field(
        default=False, description="Whether this card is a commander"
    )
    # Double-faced card support
    is_double_faced: bool = Field(
        default=False, description="Whether this card has multiple faces"
    )
    current_face: int = Field(
        default=0, description="Current face index (0 for front, 1 for back)"
    )
    card_faces: List[Dict[str, Any]] = Field(
        default_factory=list, description="Data for each face of the card"
    )

    # Counter support
    counters: Dict[str, int] = Field(
        default_factory=dict,
        description="Counters on this card (e.g., {'loyalty': 3, '+1/+1': 2})",
    )

    # Planeswalker loyalty (separate from counters for easier access)
    loyalty: Optional[int] = Field(
        default=None, description="Current loyalty for planeswalkers"
    )

    # Token support
    is_token: bool = Field(default=False, description="Whether this card is a token")
    set: Optional[str] = Field(
        default=None, description="Set code (e.g., 'mh3', 'neo')"
    )
    set_name: Optional[str] = Field(
        default=None, description="Full set name (e.g., 'Modern Horizons 3')"
    )
    face_down: bool = Field(
        default=False,
        description="Whether the card is currently face-down with hidden information",
    )
    face_down_owner: Optional[str] = Field(
        default=None,
        description="Player ID allowed to view details while the card remains face-down",
    )

    def to_instance(self, zone: str = "unknown") -> "CardInstance":
        """Convert this Card to a lightweight CardInstance for optimized serialization."""
        return CardInstance(
            unique_id=self.unique_id,
            card_id=self.id,
            scryfall_id=self.scryfall_id,
            owner_id=self.owner_id or "",
            controller_id=self.owner_id,
            zone=zone,
            tapped=self.tapped,
            attacking=self.attacking,
            blocking=self.blocking,
            targeted=self.targeted,
            counters=self.counters,
            face_down=self.face_down,
            face_down_owner=self.face_down_owner,
            current_face=self.current_face,
            attached_to=self.attached_to,
            attachment_order=self.attachment_order,
            custom_keywords=self.custom_keywords,
            custom_types=self.custom_types,
            current_power=self.current_power,
            current_toughness=self.current_toughness,
            loyalty=self.loyalty,
            is_commander=self.is_commander,
            is_token=self.is_token,
        )

    def to_definition(self) -> "CardDefinition":
        """Convert this Card to a static CardDefinition for the catalog."""
        return CardDefinition(
            card_id=self.id,
            scryfall_id=self.scryfall_id,
            name=self.name,
            mana_cost=self.mana_cost,
            cmc=self.cmc,
            card_type=self.card_type,
            subtype=self.subtype,
            text=self.text,
            power=self.power,
            toughness=self.toughness,
            colors=self.colors,
            rarity=self.rarity,
            image_url=self.image_url,
            is_double_faced=self.is_double_faced,
            card_faces=self.card_faces,
            set=self.set,
            set_name=self.set_name,
        )


class CardInstance(BaseModel):
    """
    Lightweight representation of a card instance in play.
    Contains only dynamic/runtime state, not static card data.
    Used for optimized game state serialization.
    """

    unique_id: str = Field(..., description="Unique instance identifier")
    card_id: str = Field(..., description="Reference to CardDefinition (card.id)")
    scryfall_id: Optional[str] = Field(default=None, description="Scryfall ID reference")
    owner_id: str = Field(..., description="ID of the player who owns this card")
    controller_id: Optional[str] = Field(
        default=None, description="ID of the player who currently controls this card"
    )
    zone: str = Field(..., description="Current zone (hand, battlefield, graveyard, etc.)")

    # Dynamic state
    tapped: bool = Field(default=False, description="Whether the card is tapped")
    attacking: bool = Field(default=False, description="Whether attacking")
    blocking: Optional[str] = Field(default=None, description="Unique ID of blocked attacker")
    targeted: bool = Field(default=False, description="Whether targeted")
    counters: Dict[str, int] = Field(default_factory=dict, description="Counters on the card")
    face_down: bool = Field(default=False, description="Whether face-down")
    face_down_owner: Optional[str] = Field(
        default=None, description="Player ID who can see face-down card"
    )
    current_face: int = Field(default=0, description="Current face index for DFCs")
    attached_to: Optional[str] = Field(default=None, description="Host card unique_id")
    attachment_order: Optional[int] = Field(default=None, description="Attachment ordering")
    custom_keywords: List[str] = Field(default_factory=list, description="Added keywords")
    custom_types: List[str] = Field(default_factory=list, description="Type overrides")
    current_power: Optional[str] = Field(default=None, description="Overridden power")
    current_toughness: Optional[str] = Field(default=None, description="Overridden toughness")
    loyalty: Optional[int] = Field(default=None, description="Current planeswalker loyalty")
    is_commander: bool = Field(default=False, description="Whether this is a commander")
    is_token: bool = Field(default=False, description="Whether this is a token")


class CardDefinition(BaseModel):
    """
    Static card definition data (name, types, text, images, etc.).
    Indexed by card_id in the card_catalog. Shared across all instances
    of the same card to reduce payload size.
    """

    card_id: str = Field(..., description="Unique card identifier (matches Card.id)")
    scryfall_id: Optional[str] = Field(default=None, description="Scryfall's unique ID")
    name: str = Field(..., description="Card name")
    mana_cost: str = Field(default="", description="Mana cost string")
    cmc: int = Field(default=0, description="Converted mana cost")
    card_type: CardType = Field(..., description="Primary card type")
    subtype: str = Field(default="", description="Card subtype")
    text: str = Field(default="", description="Card text/abilities")
    power: Optional[int | str] = Field(default=None, description="Base power")
    toughness: Optional[int | str] = Field(default=None, description="Base toughness")
    colors: List[Color] = Field(default_factory=list, description="Card colors")
    rarity: Rarity = Field(default=Rarity.COMMON, description="Card rarity")
    image_url: Optional[str] = Field(default=None, description="Card image URL")
    is_double_faced: bool = Field(default=False, description="Has multiple faces")
    card_faces: List[Dict[str, Any]] = Field(default_factory=list, description="Face data")
    set: Optional[str] = Field(default=None, description="Set code")
    set_name: Optional[str] = Field(default=None, description="Full set name")


class DeckCard(BaseModel):
    """A card in a deck with quantity."""

    card: Card = Field(..., description="The card")
    quantity: int = Field(..., description="Number of copies in the deck")


class GameFormat(str, Enum):
    """Supported game formats for deck construction."""

    STANDARD = "standard"
    MODERN = "modern"
    PIONEER = "pioneer"
    PAUPER = "pauper"
    LEGACY = "legacy"
    VINTAGE = "vintage"
    DUEL_COMMANDER = "duel_commander"
    COMMANDER_MULTI = "commander_multi"


class Deck(BaseModel):
    """A Magic deck."""

    id: Optional[str] = Field(default=None, description="Deck ID")
    name: str = Field(..., description="Deck name")
    cards: List[DeckCard] = Field(
        default_factory=list, description="List of cards in the deck with quantities"
    )
    sideboard: List[DeckCard] = Field(
        default_factory=list, description="Sideboard cards with quantities"
    )
    commanders: List[Card] = Field(
        default_factory=list, description="Commander cards assigned to this deck"
    )
    format: GameFormat = Field(default=GameFormat.STANDARD, description="Deck format")

    @field_validator("cards", mode="before")
    @classmethod
    def _ensure_deck_cards(cls, values):
        """
        Allow simple Card instances or dicts in tests to be coerced into
        DeckCard entries with a default quantity of 1.
        """
        if not values:
            return values

        normalized: List[Any] = []
        for entry in values:
            if isinstance(entry, DeckCard):
                normalized.append(entry)
            elif isinstance(entry, Card):
                normalized.append({"card": entry, "quantity": 1})
            else:
                normalized.append(entry)
        return normalized


class GameZone(str, Enum):
    """Game zones where cards can be."""

    LIBRARY = "library"
    HAND = "hand"
    BATTLEFIELD = "battlefield"
    GRAVEYARD = "graveyard"
    EXILE = "exile"
    STACK = "stack"


class GamePhase(str, Enum):
    """Simplified game phases like Magic Arena."""

    PREGAME = "pregame"  # Before game starts (coin flip, mulligans)
    BEGIN = "begin"
    MAIN1 = "main1"
    ATTACK = "attack"
    BLOCK = "block"
    DAMAGE = "damage"
    MAIN2 = "main2"
    END = "end"


class CombatStep(str, Enum):
    """Detailed combat sub-steps tracked by the engine."""

    NONE = "none"
    DECLARE_ATTACKERS = "declare_attackers"
    DECLARE_BLOCKERS = "declare_blockers"
    COMBAT_DAMAGE = "combat_damage"
    END_OF_COMBAT = "end_of_combat"


class PhaseMode(str, Enum):
    """Phase handling configuration for the game."""

    CASUAL = "casual"
    STRICT = "strict"


class GameStartPhase(str, Enum):
    """Phases of the pre-game setup."""

    COIN_FLIP = "coin_flip"  # Waiting for coin flip winner to choose
    MULLIGANS = "mulligans"  # Mulligan decisions in progress
    COMPLETE = "complete"  # Game has started normally


class MulliganState(BaseModel):
    """Track mulligan status for a single player."""

    has_kept: bool = Field(
        default=False, description="Whether this player has decided to keep their hand"
    )
    mulligan_count: int = Field(
        default=0, description="Number of mulligans taken by this player"
    )
    is_deciding: bool = Field(
        default=False,
        description="Whether this player is currently making a mulligan decision",
    )


class Player(BaseModel):
    """A player in a game."""

    id: str = Field(..., description="Player ID")
    name: str = Field(..., description="Player name")
    deck_name: Optional[str] = Field(
        default=None, description="Name of the deck the player is using"
    )
    life: int = Field(default=20, description="Life total")
    hand: List[Card] = Field(default_factory=list, description="Cards in hand")
    battlefield: List[Card] = Field(
        default_factory=list, description="Cards on battlefield"
    )
    graveyard: List[Card] = Field(
        default_factory=list, description="Cards in graveyard"
    )
    exile: List[Card] = Field(default_factory=list, description="Cards in exile")
    library: List[Card] = Field(default_factory=list, description="Cards in library")
    commander_zone: List[Card] = Field(
        default_factory=list, description="Cards available in the commander zone"
    )
    commander_tax: int = Field(
        default=0, description="Current commander tax (paid additional colorless mana)"
    )
    reveal_zone: List[Card] = Field(
        default_factory=list, description="Cards in the player's reveal zone"
    )
    look_zone: List[Card] = Field(
        default_factory=list,
        description="Cards the player has looked at from the library",
    )
    mana_pool: Dict[str, int] = Field(
        default_factory=dict, description="Available mana"
    )
    counters: Dict[str, int] = Field(
        default_factory=dict,
        description="Counters applied to the player (poison, energy, etc.)",
    )


class PlayerDeckStatus(BaseModel):
    """Status information about a player's deck submission."""

    submitted: bool = Field(
        default=False, description="Whether the player has submitted a deck"
    )
    validated: bool = Field(
        default=False, description="Whether the submitted deck passed validation"
    )
    seat_claimed: bool = Field(
        default=False, description="Whether the player seat is occupied in the room"
    )
    deck_name: Optional[str] = Field(
        default=None, description="Name of the submitted deck"
    )
    player_name: Optional[str] = Field(
        default=None, description="Display name chosen by the player"
    )
    card_count: int = Field(
        default=0, description="Number of cards in the submitted deck"
    )
    message: Optional[str] = Field(
        default=None, description="Optional status message for the submission"
    )


class GameSetupStatus(BaseModel):
    """Overview of the game setup process before the match starts."""

    game_id: str = Field(..., description="Game identifier")
    game_format: GameFormat = Field(..., description="Selected game format")
    phase_mode: PhaseMode = Field(..., description="Selected phase progression mode")
    max_players: int = Field(
        default=2, description="Maximum number of players supported by this game room"
    )
    status: str = Field(..., description="Human readable setup status")
    ready: bool = Field(
        default=False,
        description="True when both decks are validated and the game is initialized",
    )
    created_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for when the lobby was created (UTC)",
    )
    updated_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for the most recent change to the setup",
    )
    player_status: Dict[str, PlayerDeckStatus] = Field(
        default_factory=dict, description="Per-player deck submission statuses"
    )


class CombatState(BaseModel):
    """Fine-grained combat phase tracking."""

    step: CombatStep = Field(default=CombatStep.NONE, description="Current combat step")
    attackers_declared: bool = Field(
        default=False, description="Whether attackers have been confirmed this combat"
    )
    blockers_declared: bool = Field(
        default=False, description="Whether blockers have been confirmed this combat"
    )
    damage_resolved: bool = Field(
        default=False, description="Whether combat damage has been resolved"
    )
    expected_player: Optional[str] = Field(
        default=None, description="Player expected to act during this combat step"
    )
    pending_attackers: List[str] = Field(
        default_factory=list,
        description="Unique IDs of creatures currently selected as attackers",
    )
    pending_blockers: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of blocker unique IDs to the attackers they are assigned to",
    )


class GameState(BaseModel):
    """Current state of a Magic game."""

    id: str = Field(..., description="Game ID")
    players: List[Player] = Field(..., description="Players in the game")
    active_player: int = Field(default=0, description="Index of active player")
    phase: GamePhase = Field(default=GamePhase.BEGIN, description="Current phase")
    combat_state: CombatState = Field(
        default_factory=CombatState,
        description="State tracking for the combat phase and its sub-steps",
    )
    turn: int = Field(
        default=1, description="Turn number (increments when both players have played)"
    )
    round: int = Field(
        default=1, description="Round number (each player plays once per round)"
    )
    players_played_this_round: List[bool] = Field(
        default_factory=lambda: [False, False],
        description="Track which players have played this round",
    )
    stack: List[Card] = Field(default_factory=list, description="Spells on the stack")
    priority_player: int = Field(default=0, description="Player with priority")
    end_step_priority_passed: bool = Field(
        default=False,
        description="Whether the opponent has passed priority during the end step",
    )
    game_format: GameFormat = Field(
        default=GameFormat.STANDARD, description="Game format selection for this match"
    )
    phase_mode: PhaseMode = Field(
        default=PhaseMode.STRICT, description="Phase progression mode configuration"
    )
    setup_complete: bool = Field(
        default=True,
        description="Indicates whether the pre-game deck validation step has finished",
    )
    # Game start phase tracking (coin flip and mulligans)
    game_start_phase: GameStartPhase = Field(
        default=GameStartPhase.COMPLETE,
        description="Current phase of the pre-game setup (coin flip, mulligans, or complete)",
    )
    coin_flip_winner: Optional[int] = Field(
        default=None, description="Index of the player who won the coin flip (0 or 1)"
    )
    first_player: Optional[int] = Field(
        default=None,
        description="Index of the player who will take the first turn (0 or 1)",
    )
    mulligan_state: Dict[str, MulliganState] = Field(
        default_factory=dict, description="Mulligan status for each player"
    )
    mulligan_deciding_player: Optional[str] = Field(
        default=None, description="Player ID of who is currently deciding on mulligan"
    )
    deck_status: Dict[str, PlayerDeckStatus] = Field(
        default_factory=dict,
        description="Summary of the deck submissions used to start the game",
    )
    targeting_arrows: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Visual targeting arrows between cards (source_id -> target_id)",
    )
    created_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for when the game started (UTC)",
    )
    updated_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for the most recent change to the game state",
    )

    # Zone names for iteration
    _PLAYER_ZONES = (
        "hand",
        "battlefield",
        "graveyard",
        "exile",
        "library",
        "commander_zone",
        "reveal_zone",
        "look_zone",
    )

    # Zones where cards have no dynamic state and identity is hidden from opponents.
    # These zones use a compact format: only unique_id list + minimal card mapping.
    _HIDDEN_ZONES = ("library",)

    def _should_include_definition(
        self, card: Card, card_owner_id: str, viewer_id: Optional[str]
    ) -> bool:
        """
        Determine if a card's definition should be included in the catalog.
        Face-down cards should not reveal their identity to opponents.
        """
        if not card.face_down:
            return True
        # Face-down card: only include definition if viewer is the owner
        # or specifically allowed to see it
        if viewer_id is None:
            return False
        if card_owner_id == viewer_id:
            return True
        if card.face_down_owner == viewer_id:
            return True
        return False

    def _card_to_compact_instance(
        self,
        card: Card,
        owner_id: str,
        zone: str,
        viewer_id: Optional[str],
    ) -> Dict[str, Any]:
        """
        Convert a Card to a compact instance dict.
        For face-down cards visible to opponents, omit card_id to preserve secrecy.
        """
        include_identity = self._should_include_definition(card, owner_id, viewer_id)

        instance = {
            "unique_id": card.unique_id,
            "owner_id": owner_id,
            "controller_id": card.owner_id or owner_id,
            "zone": zone,
            "tapped": card.tapped,
            "face_down": card.face_down,
            "current_face": card.current_face,
            "is_token": card.is_token,
        }

        # Only include card identity if allowed
        if include_identity:
            instance["card_id"] = card.id
            if card.scryfall_id:
                instance["scryfall_id"] = card.scryfall_id

        # Include optional dynamic fields only if they have non-default values
        if card.attacking:
            instance["attacking"] = True
        if card.blocking:
            instance["blocking"] = card.blocking
        if card.targeted:
            instance["targeted"] = True
        if card.counters:
            instance["counters"] = card.counters
        if card.attached_to:
            instance["attached_to"] = card.attached_to
        if card.attachment_order is not None:
            instance["attachment_order"] = card.attachment_order
        if card.custom_keywords:
            instance["custom_keywords"] = card.custom_keywords
        if card.custom_types:
            instance["custom_types"] = card.custom_types
        if card.current_power is not None:
            instance["current_power"] = card.current_power
        if card.current_toughness is not None:
            instance["current_toughness"] = card.current_toughness
        if card.loyalty is not None:
            instance["loyalty"] = card.loyalty
        if card.is_commander:
            instance["is_commander"] = True

        return instance

    def to_compact_ui_data(
        self,
        viewer_id: Optional[str] = None,
        action_history: List[Dict[str, Any]] | None = None,
        chat_log: List[Dict[str, Any]] | None = None,
    ) -> Dict[str, Any]:
        """
        Generate an optimized game state for UI rendering.

        This format significantly reduces payload size by:
        1. Storing only dynamic state in card_instances
        2. Using hidden_zone_cards for library (just unique_id -> card_id)
        3. Omitting card identity for face-down cards (for opponents)
        4. NOT including card_catalog - client fetches via /api/v1/cards/{card_id}

        Args:
            viewer_id: The player ID viewing this data. Used to determine
                       what information to reveal for face-down cards.
            action_history: Action history entries to include in the payload.
            chat_log: Chat messages to include in the payload.

        Returns:
            A dict with schema_version, game metadata, players, card_instances.
            No card_catalog - client fetches on demand.
        """
        if action_history is None or chat_log is None:
            raise ValueError("action_history and chat_log must be provided")
        card_instances: Dict[str, Dict[str, Any]] = {}
        player_data: List[Dict[str, Any]] = []

        for player in self.players:
            zones_data: Dict[str, List[str]] = {}

            for zone_name in self._PLAYER_ZONES:
                zone_cards: List[Card] = getattr(player, zone_name, [])
                is_hidden_zone = zone_name in self._HIDDEN_ZONES

                if is_hidden_zone:
                    # Hidden zones: store ordered list of card_ids directly
                    # Client reconstructs unique_ids from position if needed
                    zones_data[zone_name] = [card.id for card in zone_cards]
                else:
                    zone_ids: List[str] = []
                    for card in zone_cards:
                        zone_ids.append(card.unique_id)
                        # Regular zones: full CardInstance with dynamic state
                        instance = self._card_to_compact_instance(
                            card, player.id, zone_name, viewer_id
                        )
                        card_instances[card.unique_id] = instance
                    zones_data[zone_name] = zone_ids

            player_data.append(
                {
                    "id": player.id,
                    "name": player.name,
                    "deck_name": player.deck_name,
                    "life": player.life,
                    "mana_pool": player.mana_pool,
                    "counters": player.counters,
                    "commander_tax": player.commander_tax,
                    "zones": zones_data,
                }
            )

        # Process stack
        stack_ids: List[str] = []
        for card in self.stack:
            instance = self._card_to_compact_instance(card, card.owner_id or "", "stack", viewer_id)
            card_instances[card.unique_id] = instance
            stack_ids.append(card.unique_id)

        return {
            "schema_version": 1,
            "game_id": self.id,
            "turn": self.turn,
            "round": self.round,
            "phase": self.phase.value,
            "phase_mode": self.phase_mode.value,
            "game_format": self.game_format.value,
            "active_player": self.active_player,
            "priority_player": self.priority_player,
            "end_step_priority_passed": self.end_step_priority_passed,
            "setup_complete": self.setup_complete,
            "game_start_phase": self.game_start_phase.value,
            "coin_flip_winner": self.coin_flip_winner,
            "first_player": self.first_player,
            "mulligan_state": {
                pid: ms.model_dump(mode="json")
                for pid, ms in self.mulligan_state.items()
            },
            "mulligan_deciding_player": self.mulligan_deciding_player,
            "combat_state": self.combat_state.model_dump(mode="json"),
            "players": player_data,
            "stack": stack_ids,
            "card_instances": card_instances,
            "action_history": action_history,
            "chat_log": chat_log,
            "targeting_arrows": self.targeting_arrows,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GameAction(BaseModel):
    """An action taken in the game."""

    player_id: str = Field(..., description="Player taking the action")
    action_type: str = Field(..., description="Type of action")
    card_id: Optional[str] = Field(default=None, description="Card involved in action")
    target: Optional[str] = Field(default=None, description="Target of the action")
    additional_data: Dict[str, Any] = Field(
        default_factory=dict, description="Additional action data"
    )


# Models for the draft feature
class DraftType(str, Enum):
    BOOSTER_DRAFT = "booster_draft"
    SEALED = "sealed"
    CUBE = "cube"


class DraftState(str, Enum):
    WAITING = "waiting"
    DRAFTING = "drafting"
    COMPLETED = "completed"


class DraftPlayer(BaseModel):
    id: str
    name: str
    is_bot: bool = False
    has_picked_card: bool = False
    drafted_cards: List[Card] = Field(default_factory=list)
    current_pack: List[Card] = Field(default_factory=list)


class CubeConfiguration(BaseModel):
    cube_id: Optional[str] = None
    source_url: Optional[str] = None
    name: Optional[str] = None
    card_count: int = 0


class DraftRoom(BaseModel):
    id: str
    name: str
    set_code: str
    set_name: str
    max_players: int = 8
    players: List[DraftPlayer] = Field(default_factory=list)
    draft_type: DraftType = DraftType.BOOSTER_DRAFT
    state: DraftState = DraftState.WAITING
    current_pack_number: int = 1
    current_pick_number: int = 1
    packs: List[List[List[Card]]] = Field(default_factory=list)
    pack_direction: int = 1
    cube_configuration: Optional[CubeConfiguration] = None
