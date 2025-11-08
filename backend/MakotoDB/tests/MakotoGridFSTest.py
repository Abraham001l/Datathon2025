from pymongo import MongoClient
import gridfs
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env file from backend folder (two folders up from tests)
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

# Get password from environment variable
PASSWORD = os.getenv('MONGODB_PASS', '')
print(PASSWORD)

# 1. Connect to your Atlas Cluster
# Get this string from your Atlas "Connect" dialog
CONNECTION_STRING = f"mongodb+srv://jado:{PASSWORD}@maincluster.7vhuca.mongodb.net/?appName=MainCluster"

client = MongoClient(CONNECTION_STRING)

# 2. Access your database
# Use the database name you created
db = client['document_sensitivity_db']

# 3. Create a GridFS object
# This gives you the interface to read/write files
fs = gridfs.GridFS(db)

# --- How to UPLOAD a File ---

# 'rb' means 'read binary', which is essential for files
with open(r"C:\Users\jadot\Downloads\HitachiDS_Datathon_Challenges_Package\HitachiDS_Datathon_Challenges_Package\TC1_Sample_Public_Marketing_Document.pdf", 'rb') as f:
    
    # Put the file into GridFS
    # This returns the unique ID of the stored file
    file_id = fs.put(
        f,
        filename="TC1-Public-Marketing-Document.pdf",
        description="Public Marketing Document for TC1",
        category="Public",
        status="pending_classification",
        ai_classified_sensitivity="unclassified"
    )

print(f"File stored with ID: {file_id}")


# --- How to DOWNLOAD/READ a File ---

# You find the file using its ID or any other metadata
file_to_read = fs.get(file_id)

# You can now read the file's contents
pdf_contents = file_to_read.read()

# You can also access its metadata
print(f"Reading file: {file_to_read.filename}")
print(f"Description: {file_to_read.description}")

# Don't forget to close the file and the connection
file_to_read.close()
client.close()