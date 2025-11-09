"""Database service for MongoDB connection management."""
import logging
import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import gridfs
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Get credentials from environment variables
MONGO_PASSWORD = os.getenv('MONGODB_PASS', '')
MONGO_USERNAME = os.getenv('MONGODB_USER', '')

# Connection string
CONNECTION_STRING = f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@maincluster.7vhuca.mongodb.net/?appName=MainCluster"

# Create a global client instance
client = None
db = None
fs = None


def verify_connection():
    """Verify MongoDB connection by attempting to connect and ping the server."""
    global client, db, fs
    
    try:
        logger.info("Verifying MongoDB connection...")
        
        # Check if credentials are set
        if not MONGO_USERNAME or not MONGO_PASSWORD:
            logger.error("MongoDB credentials not found in environment variables")
            raise ValueError("MONGODB_USER and MONGODB_PASS must be set in environment variables")
        
        logger.debug(f"Connecting to MongoDB with user: {MONGO_USERNAME}")
        
        # Create a test client with a short timeout for verification
        test_client = MongoClient(CONNECTION_STRING, serverSelectionTimeoutMS=5000)
        
        # Ping the server to verify connection
        test_client.admin.command('ping')
        logger.info("MongoDB connection verified successfully")
        
        # Test database access
        test_db = test_client['document_sensitivity_db']
        test_db.list_collection_names()
        logger.info("Database access verified: document_sensitivity_db")
        
        # Test GridFS
        test_fs = gridfs.GridFS(test_db)
        logger.info("GridFS access verified")
        
        # Close test client
        test_client.close()
        
        return True
        
    except ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB connection timeout: {str(e)}")
        raise ConnectionFailure(f"Unable to connect to MongoDB server: {str(e)}")
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failed: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error verifying MongoDB connection: {str(e)}", exc_info=True)
        raise


def get_database():
    """Get database connection. Creates connection if it doesn't exist."""
    global client, db, fs
    
    if client is None:
        logger.debug("Creating new MongoDB connection")
        
        # Check if credentials are set
        if not MONGO_USERNAME or not MONGO_PASSWORD:
            logger.error("MongoDB credentials not found in environment variables")
            raise ValueError("MONGODB_USER and MONGODB_PASS must be set in environment variables")
        
        try:
            # Create client with reasonable timeout
            client = MongoClient(CONNECTION_STRING, serverSelectionTimeoutMS=10000)
            db = client['document_sensitivity_db']
            fs = gridfs.GridFS(db)
            
            # Verify connection works (this will raise if connection fails)
            client.admin.command('ping')
            logger.info("MongoDB connection established successfully")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to establish MongoDB connection: {str(e)}")
            # Clean up failed client
            if client is not None:
                try:
                    client.close()
                except:
                    pass
                client = None
            raise ConnectionFailure(f"Unable to connect to MongoDB: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error establishing MongoDB connection: {str(e)}", exc_info=True)
            if client is not None:
                try:
                    client.close()
                except:
                    pass
                client = None
            raise
    
    return db, fs


def close_database():
    """Close database connection."""
    global client
    if client is not None:
        logger.info("Closing MongoDB connection")
        client.close()
        client = None

