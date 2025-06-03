"""
Database connection and setup.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


class Database:
    """Database connection manager."""
    
    client: AsyncIOMotorClient = None
    database = None


db = Database()


async def get_database():
    """Get database instance."""
    return db.database


async def connect_to_mongo():
    """Create database connection."""
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.database = db.client[settings.database_name]
    
    # Test connection
    try:
        await db.client.admin.command('ping')
        print(f"Connected to MongoDB at {settings.mongodb_url}")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")


async def close_mongo_connection():
    """Close database connection."""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")
