"""
Tests pour les modèles de données avec les nouvelles versions de Pydantic.
"""

import pytest
from pydantic import ValidationError

from app.models.game import Card, Deck, GameState, CardType, Rarity, Color


class TestCardModel:
    """Tests pour le modèle Card."""
    
    def test_card_creation_basic(self):
        """Test la création d'une carte basique."""
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
        """Test création d'une créature avec force/endurance."""
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
        """Test les erreurs de validation."""
        # Test avec un type de carte invalide
        with pytest.raises(ValidationError):
            Card(
                id="invalid-001",
                name="Invalid Card",
                mana_cost="1",
                card_type="invalid_type",  # Type invalide
                rarity=Rarity.COMMON,
                colors=[Color.WHITE]
            )


class TestEnums:
    """Tests pour les énumérations."""
    
    def test_card_type_enum(self):
        """Test l'énumération CardType."""
        assert CardType.CREATURE == "creature"
        assert CardType.INSTANT == "instant"
        assert CardType.LAND == "land"
    
    def test_rarity_enum(self):
        """Test l'énumération Rarity."""
        assert Rarity.COMMON == "common"
        assert Rarity.RARE == "rare"
        assert Rarity.MYTHIC == "mythic"
    
    def test_color_enum(self):
        """Test l'énumération Color."""
        assert Color.WHITE == "W"
        assert Color.BLUE == "U"
        assert Color.BLACK == "B"
        assert Color.RED == "R"
        assert Color.GREEN == "G"


class TestDeckModel:
    """Tests pour le modèle Deck."""
    
    def test_deck_creation(self):
        """Test la création d'un deck."""
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
            cards=[card.model_dump()],
            format="standard"
        )
        
        assert deck.name == "Red Burn"
        assert len(deck.cards) == 1
        assert deck.format == "standard"
    
    def test_empty_deck(self):
        """Test la création d'un deck vide."""
        deck = Deck(
            name="Empty Deck",
            cards=[],
            format="standard"
        )
        
        assert deck.name == "Empty Deck"
        assert len(deck.cards) == 0
        assert deck.format == "standard"


class TestPydanticV2Features:
    """Tests des nouvelles fonctionnalités de Pydantic v2."""
    
    def test_model_dump(self):
        """Test la nouvelle méthode model_dump de Pydantic v2."""
        card = Card(
            id="test-001",
            name="Test Card",
            mana_cost="1",
            card_type=CardType.INSTANT,
            rarity=Rarity.COMMON,
            colors=[Color.WHITE],
            text="Test text."
        )
        
        # Test model_dump (nouvelle API Pydantic v2)
        data = card.model_dump()
        assert isinstance(data, dict)
        assert data["name"] == "Test Card"
        assert data["card_type"] == "instant"
    
    def test_model_validate(self):
        """Test la méthode model_validate de Pydantic v2."""
        card_data = {
            "id": "test-002",
            "name": "Test Card",
            "mana_cost": "2U",
            "card_type": "instant",
            "rarity": "uncommon",
            "colors": ["U"],
            "text": "Draw a card."
        }
        
        # Test model_validate (nouvelle API Pydantic v2)
        card = Card.model_validate(card_data)
        assert card.name == "Test Card"
        assert card.mana_cost == "2U"
        assert card.card_type == CardType.INSTANT
        assert card.rarity == Rarity.UNCOMMON
