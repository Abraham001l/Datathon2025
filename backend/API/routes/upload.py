from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import sys
from pathlib import Path

# Add parent directory to path to import database
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))
from database import get_database

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = "pending_classification",
    ai_classified_sensitivity: Optional[str] = "unclassified"
):
    """
    Upload a document to GridFS.
    
    - **file**: The file to upload (PDF, etc.)
    - **description**: Optional description of the document
    - **category**: Optional category classification
    - **status**: Document status (default: "pending_classification")
    - **ai_classified_sensitivity**: AI classification (default: "unclassified")
    """
    try:
        # Get database and GridFS instance
        db, fs = get_database()
        
        # Read file contents
        file_contents = await file.read()
        
        # Prepare metadata
        metadata = {
            "filename": file.filename or "unnamed_file",
            "content_type": file.content_type or "application/octet-stream"
        }
        
        if description:
            metadata["description"] = description
        if category:
            metadata["category"] = category
        if status:
            metadata["status"] = status
        if ai_classified_sensitivity:
            metadata["ai_classified_sensitivity"] = ai_classified_sensitivity
        
        # Store file in GridFS
        file_id = fs.put(
            file_contents,
            **metadata
        )
        
        return JSONResponse(
            status_code=201,
            content={
                "message": "File uploaded successfully",
                "file_id": str(file_id),
                "filename": file.filename,
                "metadata": metadata
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading file: {str(e)}"
        )

