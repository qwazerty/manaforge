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
        description="Unique instance identifier for a card in a game"
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
    power: Optional[int | str] = Field(
        default=None, description="Creature power"
    )
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
    image_url: Optional[str] = Field(
        default=None, description="Card image URL"
    )
    tapped: bool = Field(
        default=False, description="Whether the card is tapped"
    )
    targeted: bool = Field(
        default=False, description="Whether the card is targeted"
    )
    # Combat support
    attacking: bool = Field(
        default=False, description="Whether the creature is currently attacking"
    )
    blocking: Optional[str] = Field(
        default=None, description="Unique ID of the attacker this creature is blocking"
    )
    custom_keywords: List[str] = Field(
        default_factory=list,
        description="Player-added keywords displayed directly on the card overlay"
    )
    custom_types: List[str] = Field(
        default_factory=list,
        description="Manual card type overrides that influence battlefield grouping"
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
        default_factory=dict, description="Counters on this card (e.g., {'loyalty': 3, '+1/+1': 2})"
    )
    
    # Planeswalker loyalty (separate from counters for easier access)
    loyalty: Optional[int] = Field(
        default=None, description="Current loyalty for planeswalkers"
    )
    
    # Token support
    is_token: bool = Field(
        default=False, description="Whether this card is a token"
    )



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
        default_factory=list,
        description="List of cards in the deck with quantities"
    )
    sideboard: List[DeckCard] = Field(
        default_factory=list,
        description="Sideboard cards with quantities"
    )
    commanders: List[Card] = Field(
        default_factory=list,
        description="Commander cards assigned to this deck"
    )
    format: GameFormat = Field(
        default=GameFormat.STANDARD,
        description="Deck format"
    )

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
    exile: List[Card] = Field(
        default_factory=list, description="Cards in exile"
    )
    library: List[Card] = Field(
        default_factory=list, description="Cards in library"
    )
    commander_zone: List[Card] = Field(
        default_factory=list,
        description="Cards available in the commander zone"
    )
    commander_tax: int = Field(
        default=0,
        description="Current commander tax (paid additional colorless mana)"
    )
    reveal_zone: List[Card] = Field(
        default_factory=list, description="Cards in the player's reveal zone"
    )
    mana_pool: Dict[str, int] = Field(
        default_factory=dict, description="Available mana"
    )
    temporary_zone: List[Card] = Field(
        default_factory=list,
        description="Temporary zone for scry/surveil"
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
    status: str = Field(..., description="Human readable setup status")
    ready: bool = Field(
        default=False,
        description="True when both decks are validated and the game is initialized"
    )
    created_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for when the lobby was created (UTC)"
    )
    player_status: Dict[str, PlayerDeckStatus] = Field(
        default_factory=dict,
        description="Per-player deck submission statuses"
    )

class CombatState(BaseModel):
    """Fine-grained combat phase tracking."""
    step: CombatStep = Field(
        default=CombatStep.NONE,
        description="Current combat step"
    )
    attackers_declared: bool = Field(
        default=False,
        description="Whether attackers have been confirmed this combat"
    )
    blockers_declared: bool = Field(
        default=False,
        description="Whether blockers have been confirmed this combat"
    )
    damage_resolved: bool = Field(
        default=False,
        description="Whether combat damage has been resolved"
    )
    expected_player: Optional[str] = Field(
        default=None,
        description="Player expected to act during this combat step"
    )
    pending_attackers: List[str] = Field(
        default_factory=list,
        description="Unique IDs of creatures currently selected as attackers"
    )
    pending_blockers: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of blocker unique IDs to the attackers they are assigned to"
    )


class GameState(BaseModel):
    """Current state of a Magic game."""
    id: str = Field(..., description="Game ID")
    players: List[Player] = Field(..., description="Players in the game")
    active_player: int = Field(default=0, description="Index of active player")
    phase: GamePhase = Field(default=GamePhase.BEGIN, description="Current phase")
    combat_state: CombatState = Field(
        default_factory=CombatState,
        description="State tracking for the combat phase and its sub-steps"
    )
    turn: int = Field(
        default=1,
        description="Turn number (increments when both players have played)"
    )
    round: int = Field(
        default=1,
        description="Round number (each player plays once per round)"
    )
    players_played_this_round: List[bool] = Field(
        default_factory=lambda: [False, False],
        description="Track which players have played this round"
    )
    stack: List[Card] = Field(
        default_factory=list, description="Spells on the stack"
    )
    priority_player: int = Field(default=0, description="Player with priority")
    game_format: GameFormat = Field(
        default=GameFormat.STANDARD, description="Game format selection for this match"
    )
    phase_mode: PhaseMode = Field(
        default=PhaseMode.STRICT, description="Phase progression mode configuration"
    )
    setup_complete: bool = Field(
        default=True,
        description="Indicates whether the pre-game deck validation step has finished"
    )
    deck_status: Dict[str, PlayerDeckStatus] = Field(
        default_factory=dict,
        description="Summary of the deck submissions used to start the game"
    )
    action_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Ordered history of in-game actions for UI rendering"
    )
    chat_log: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Chat messages exchanged during the game session"
    )
    pending_action: Optional[Dict[str, Any]] = Field(
        default=None,
        description="A pending action requiring player input, e.g., for scry/surveil"
    )
    created_at: datetime = Field(
        default_factory=current_utc_datetime,
        description="Timestamp for when the game started (UTC)"
    )


class GameAction(BaseModel):
    """An action taken in the game."""
    player_id: str = Field(..., description="Player taking the action")
    action_type: str = Field(..., description="Type of action")
    card_id: Optional[str] = Field(
        default=None, description="Card involved in action"
    )
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
