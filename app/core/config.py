"""
ManaForge - Magic The Gathering Online Platform
Configuration settings for the application.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    app_name: str = "ManaForge"
    debug: bool = True

    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
