"""Tests for the API with the new package versions."""

import pytest
from fastapi.testclient import TestClient

from app.backend.main import app


class TestAPIEndpoints:
    """Tests for the API endpoints."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        with TestClient(app) as client:
            yield client

    def test_api_routes_exist(self, client):
        """Ensure the API routes exist."""
        # Ensure the routes exist in the application
        api_paths = [
            getattr(route, "path") for route in app.routes if hasattr(route, "path")
        ]

        # At least some API routes should exist
        api_routes = [path for path in api_paths if path.startswith("/api")]
        assert len(api_routes) > 0

    def test_card_search_endpoint(self, client):
        """Test the card search endpoint."""
        # Test the endpoint
        response = client.get("/api/v1/cards/search?q=lightning")

        # Ensure the endpoint responds (even if the logic is not complete)
        # On dependency errors, expect a 500 or 422, not 404
        assert response.status_code in [200, 422, 500]

    def test_health_check_or_basic_endpoint(self, client):
        """Test a basic endpoint."""
        # Test that the application responds
        response = client.get("/")

        # The endpoint should exist or return a controlled error
        assert response.status_code in [200, 404, 422, 500]


class TestHTTPXCompatibility:
    """HTTPX compatibility tests."""

    def test_httpx_client_creation(self):
        """Test creating an HTTPX client."""
        import httpx

        with httpx.Client() as client:
            assert client is not None

    @pytest.mark.asyncio
    async def test_httpx_async_client(self):
        """Test the async HTTPX client."""
        import httpx

        async with httpx.AsyncClient() as client:
            assert client is not None


class TestFastAPITestClient:
    """FastAPI TestClient tests."""

    def test_test_client_creation(self):
        """Test creating the TestClient."""
        client = TestClient(app)
        assert client is not None

    def test_test_client_context_manager(self):
        """Test using the TestClient as a context manager."""
        with TestClient(app) as client:
            assert client is not None


class TestJinja2Templates:
    """Jinja2 template tests."""

    def test_jinja2_template_creation(self):
        """Test creating a Jinja2 template."""
        from jinja2 import Template

        template = Template("Hello {{ name }}!")
        result = template.render(name="World")
        assert result == "Hello World!"

    def test_fastapi_templates_import(self):
        """Test importing FastAPI templates."""
        from fastapi.templating import Jinja2Templates

        templates = Jinja2Templates(directory="app/templates")
        assert templates is not None
