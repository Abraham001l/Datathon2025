from pymongo import MongoClient
import gridfs
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env file from backend folder
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Get password from environment variable
PASSWORD = os.getenv('MONGODB_PASS', '')

# Connection string
CONNECTION_STRING = f"mongodb+srv://jado:{PASSWORD}@maincluster.7vhuca.mongodb.net/?appName=MainCluster"

# Create a global client instance
client = None
db = None
fs = None


def get_database():
    """Get database connection. Creates connection if it doesn't exist."""
    global client, db, fs
    
    if client is None:
        client = MongoClient(CONNECTION_STRING)
        db = client['document_sensitivity_db']
        fs = gridfs.GridFS(db)
    
    return db, fs


def close_database():
    """Close database connection."""
    global client
    if client is not None:
        client.close()
        client = None

