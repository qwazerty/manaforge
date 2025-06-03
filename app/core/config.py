"""
ManaForge - Magic The Gathering Online Platform
Configuration settings for the application.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    app_name: str = "ManaForge"
    debug: bool = True
    
    # Database
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "manaforge"
    
    # Security
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"


settings = Settings()
