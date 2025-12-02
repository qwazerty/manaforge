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
    
    host: str = "0.0.0.0"
    port: int = 8000
    
    model_config = ConfigDict(env_file=".env", extra="ignore")


settings = Settings()
