from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from bson import ObjectId
from typing import Optional
import sys
from pathlib import Path

# Add parent directory to path to import database
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))
from database import get_database

router = APIRouter(prefix="/view", tags=["view"])


def generate_file_chunks(file_stream, chunk_size: int = 8192):
    """Generator function to yield file chunks for streaming."""
    while True:
        chunk = file_stream.read(chunk_size)
        if not chunk:
            break
        yield chunk


@router.get("/document/ids")
async def list_file_ids(
    limit: Optional[int] = None
):
    """
    Get a simple list of file IDs from GridFS.
    
    - **limit**: Maximum number of file IDs to return (default: all)
    """
    try:
        db, fs = get_database()
        
        # Get list of file IDs
        file_ids = []
        query = fs.find()
        if limit:
            query = query.limit(limit)
        
        for grid_file in query:
            file_ids.append(str(grid_file._id))
        
        return {
            "file_ids": file_ids,
            "count": len(file_ids)
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing file IDs: {str(e)}"
        )


@router.get("/document")
async def list_documents(
    limit: Optional[int] = 10,
    skip: Optional[int] = 0
):
    """
    List available documents in GridFS with full metadata.
    
    - **limit**: Maximum number of documents to return (default: 10)
    - **skip**: Number of documents to skip (default: 0)
    """
    try:
        db, fs = get_database()
        
        # Get list of files from GridFS
        files = []
        for grid_file in fs.find().skip(skip).limit(limit):
            files.append({
                "file_id": str(grid_file._id),
                "filename": grid_file.filename,
                "upload_date": grid_file.upload_date.isoformat() if hasattr(grid_file, 'upload_date') else None,
                "length": grid_file.length,
                "content_type": grid_file.content_type,
                "metadata": {
                    "description": getattr(grid_file, 'description', None),
                    "category": getattr(grid_file, 'category', None),
                    "status": getattr(grid_file, 'status', None),
                    "ai_classified_sensitivity": getattr(grid_file, 'ai_classified_sensitivity', None),
                }
            })
        
        return {
            "files": files,
            "count": len(files),
            "limit": limit,
            "skip": skip
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing files: {str(e)}"
        )


@router.get("/document/{file_id}")
async def stream_document(file_id: str):
    """
    Stream a PDF document from GridFS by file ID.
    
    - **file_id**: The MongoDB ObjectId of the file to stream
    """
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(file_id)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid file ID format"
            )
        
        # Get database and GridFS instance
        db, fs = get_database()
        
        # Check if file exists
        if not fs.exists(object_id):
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        # Get file from GridFS
        grid_file = fs.get(object_id)
        
        # Get filename and content type from metadata
        filename = grid_file.filename or "document.pdf"
        content_type = grid_file.content_type or "application/pdf"
        
        # Create streaming response
        return StreamingResponse(
            generate_file_chunks(grid_file),
            media_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Content-Type": content_type
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error streaming file: {str(e)}"
        )

