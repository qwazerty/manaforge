"""Tests for the data models with the new versions of Pydantic."""

import pytest
from pydantic import ValidationError

from app.models.game import Card, Deck, GameState, CardType, Rarity, Color


class TestCardModel:
    """Tests for the Card model."""
    
    def test_card_creation_basic(self):
        """Test creating a basic card."""
        card = Card(
            id="bolt-001",
            name="Lightning Bolt",
            mana_cost="R",
            card_type=CardType.INSTANT,
            rarity=Rarity.COMMON,
            colors=[Color.RED],
            text="Lightning Bolt deals 3 damage to any target."
        )
        
        assert card.name == "Lightning Bolt"
        assert card.mana_cost == "R"
        assert card.card_type == CardType.INSTANT
        assert card.rarity == Rarity.COMMON
        assert Color.RED in card.colors
    
    def test_card_with_power_toughness(self):
        """Test creating a creature with power/toughness."""
        card = Card(
            id="bears-001",
            name="Grizzly Bears",
            mana_cost="1G",
            card_type=CardType.CREATURE,
            rarity=Rarity.COMMON,
            colors=[Color.GREEN],
            text="A bear.",
            power=2,
            toughness=2
        )
        
        assert card.name == "Grizzly Bears"
        assert card.power == 2
        assert card.toughness == 2
        assert card.card_type == CardType.CREATURE
    
    def test_card_validation_error(self):
        """Test validation errors."""
        # Test with an invalid card type
        with pytest.raises(ValidationError):
            Card(
                id="invalid-001",
                name="Invalid Card",
                mana_cost="1",
                card_type="invalid_type",  # Invalid type
                rarity=Rarity.COMMON,
                colors=[Color.WHITE]
            )


class TestEnums:
    """Tests for the enums."""
    
    def test_card_type_enum(self):
        """Test the CardType enum."""
        assert CardType.CREATURE == "creature"
        assert CardType.INSTANT == "instant"
        assert CardType.LAND == "land"
    
    def test_rarity_enum(self):
        """Test the Rarity enum."""
        assert Rarity.COMMON == "common"
        assert Rarity.RARE == "rare"
        assert Rarity.MYTHIC == "mythic"
    
    def test_color_enum(self):
        """Test the Color enum."""
        assert Color.WHITE == "W"
        assert Color.BLUE == "U"
        assert Color.BLACK == "B"
        assert Color.RED == "R"
        assert Color.GREEN == "G"


class TestDeckModel:
    """Tests for the Deck model."""
    
    def test_deck_creation(self):
        """Test creating a deck."""
        card = Card(
            id="bolt-001",
            name="Lightning Bolt",
            mana_cost="R",
            card_type=CardType.INSTANT,
            rarity=Rarity.COMMON,
            colors=[Color.RED],
            text="Lightning Bolt deals 3 damage to any target."
        )
        
        deck = Deck(
            name="Red Burn",
            cards=[card],
            format="standard"
        )
        
        assert deck.name == "Red Burn"
        assert len(deck.cards) == 1
        assert deck.format == "standard"
    
    def test_empty_deck(self):
        """Test creating an empty deck."""
        deck = Deck(
            name="Empty Deck",
            cards=[],
            format="standard"
        )
        
        assert deck.name == "Empty Deck"
        assert len(deck.cards) == 0
        assert deck.format == "standard"


class TestPydanticV2Features:
    """Tests for new Pydantic v2 features."""
    
    def test_model_dump(self):
        """Test the new Pydantic v2 model_dump method."""
        card = Card(
            id="test-001",
            name="Test Card",
            mana_cost="1",
            card_type=CardType.INSTANT,
            rarity=Rarity.COMMON,
            colors=[Color.WHITE],
            text="Test text."
        )
        
        # Test model_dump (new Pydantic v2 API)
        data = card.model_dump()
        assert isinstance(data, dict)
        assert data["name"] == "Test Card"
        assert data["card_type"] == "instant"
    
    def test_model_validate(self):
        """Test the Pydantic v2 model_validate method."""
        card_data = {
            "id": "test-002",
            "name": "Test Card",
            "mana_cost": "2U",
            "card_type": "instant",
            "rarity": "uncommon",
            "colors": ["U"],
            "text": "Draw a card."
        }
        
        # Test model_validate (new Pydantic v2 API)
        card = Card.model_validate(card_data)
        assert card.name == "Test Card"
        assert card.mana_cost == "2U"
        assert card.card_type == CardType.INSTANT
        assert card.rarity == Rarity.UNCOMMON
