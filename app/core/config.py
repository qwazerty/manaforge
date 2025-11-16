"""
ManaForge - Magic The Gathering Online Platform
Configuration settings for the application.
"""

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    app_name: str = "ManaForge"
    debug: bool = True
    
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "manaforge"
    
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    host: str = "0.0.0.0"
    port: int = 8000
    
    model_config = ConfigDict(env_file=".env")


settings = Settings()
