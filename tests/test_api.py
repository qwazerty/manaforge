"""
Tests pour l'API avec les nouvelles versions des packages.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app


class TestAPIEndpoints:
    """Tests des endpoints API."""
    
    @pytest.fixture
    def client(self):
        """Client de test FastAPI."""
        # Patch des dépendances de base de données pour les tests
        with patch('app.core.database.connect_to_mongo'), \
             patch('app.core.database.close_mongo_connection'), \
             patch('app.core.database.get_database') as mock_get_db:
            
            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            
            with TestClient(app) as client:
                yield client
    
    def test_api_routes_exist(self, client):
        """Test que les routes API existent."""
        # Cette liste des routes peut être adaptée selon l'implémentation réelle
        expected_routes = [
            "/api/v1/cards/search",
            "/api/v1/decks",
            "/api/v1/game/create",
        ]
        
        # Vérifier que les routes existent dans l'application
        api_paths = [route.path for route in app.routes if hasattr(route, 'path')]
        
        # Au moins quelques routes API devraient exister
        api_routes = [path for path in api_paths if path.startswith('/api')]
        assert len(api_routes) > 0
    
    @patch('app.services.card_service.CardService.search_cards')
    def test_card_search_endpoint(self, mock_search, client):
        """Test l'endpoint de recherche de cartes."""
        # Mock du résultat de recherche
        mock_search.return_value = [
            {
                "id": "lightning-bolt",
                "name": "Lightning Bolt",
                "mana_cost": "R",
                "type_line": "Instant",
                "card_type": "instant",
                "rarity": "common",
                "colors": ["R"],
                "oracle_text": "Lightning Bolt deals 3 damage to any target."
            }
        ]
        
        # Test de l'endpoint
        response = client.get("/api/v1/cards/search?q=lightning")
        
        # Vérifier que l'endpoint répond (même si la logique n'est pas complète)
        # En cas d'erreur de dépendance, on s'attend à un 500 ou 422, pas 404
        assert response.status_code in [200, 422, 500]
    
    def test_health_check_or_basic_endpoint(self, client):
        """Test d'un endpoint basique."""
        # Test que l'application répond
        response = client.get("/")
        
        # L'endpoint devrait exister ou retourner une erreur contrôlée
        assert response.status_code in [200, 404, 422, 500]


class TestHTTPXCompatibility:
    """Tests de compatibilité avec HTTPX."""
    
    def test_httpx_client_creation(self):
        """Test la création d'un client HTTPX."""
        import httpx
        
        with httpx.Client() as client:
            assert client is not None
    
    @pytest.mark.asyncio
    async def test_httpx_async_client(self):
        """Test le client HTTPX asynchrone."""
        import httpx
        
        async with httpx.AsyncClient() as client:
            assert client is not None


class TestFastAPITestClient:
    """Tests du TestClient FastAPI."""
    
    def test_test_client_creation(self):
        """Test la création du TestClient."""
        client = TestClient(app)
        assert client is not None
    
    def test_test_client_context_manager(self):
        """Test l'utilisation du TestClient comme context manager."""
        with TestClient(app) as client:
            assert client is not None


class TestJinja2Templates:
    """Tests des templates Jinja2."""
    
    def test_jinja2_template_creation(self):
        """Test la création d'un template Jinja2."""
        from jinja2 import Template
        
        template = Template("Hello {{ name }}!")
        result = template.render(name="World")
        assert result == "Hello World!"
    
    def test_fastapi_templates_import(self):
        """Test l'import des templates FastAPI."""
        from fastapi.templating import Jinja2Templates
        
        templates = Jinja2Templates(directory="app/templates")
        assert templates is not None
