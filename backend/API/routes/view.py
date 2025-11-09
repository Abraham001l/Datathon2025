import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from bson import ObjectId
from typing import Optional
import sys
from pathlib import Path
from pprint import pprint

# Add parent directory to path to import database
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))
from database import get_database

logger = logging.getLogger(__name__)
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
    logger.info(f"List file IDs request received, limit: {limit}")
    try:
        db, fs = get_database()
        logger.debug("Connected to database")
        
        # Get list of file IDs
        file_ids = []
        query = fs.find()
        if limit:
            query = query.limit(limit)
            logger.debug(f"Query limited to {limit} files")
        
        for grid_file in query:
            file_ids.append(str(grid_file._id))
        
        logger.info(f"Retrieved {len(file_ids)} file IDs")
        return {
            "file_ids": file_ids,
            "count": len(file_ids)
        }
    
    except Exception as e:
        logger.error(f"Error listing file IDs: {str(e)}", exc_info=True)
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
    logger.info(f"List documents request received, limit: {limit}, skip: {skip}")
    try:
        db, fs = get_database()
        logger.debug("Connected to database")
        
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
        
        logger.info(f"Retrieved {len(files)} documents")
        return {
            "files": files,
            "count": len(files),
            "limit": limit,
            "skip": skip
        }
    
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}", exc_info=True)
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
    logger.info(f"Stream document request received for file_id: {file_id}")
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(file_id)
        except Exception:
            logger.warning(f"Invalid file ID format: {file_id}")
            raise HTTPException(
                status_code=400,
                detail="Invalid file ID format"
            )
        
        # Get database and GridFS instance
        logger.debug("Connecting to database")
        db, fs = get_database()
        
        # Check if file exists
        if not fs.exists(object_id):
            logger.warning(f"File not found: {file_id}")
            raise HTTPException(
                status_code=404,
                detail="File not found"
            )
        
        # Get file from GridFS
        grid_file = fs.get(object_id)
        logger.debug(f"File retrieved: {grid_file.filename}, size: {grid_file.length} bytes")
        
        # Get filename and content type from metadata
        filename = grid_file.filename or "document.pdf"
        content_type = grid_file.content_type or "application/pdf"
        
        logger.info(f"Streaming file: {filename}, content_type: {content_type}")
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
        logger.error(f"Error streaming file {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error streaming file: {str(e)}"
        )

@router.get("/document/{file_id}/bounding_boxes")
async def get_document_bounding_boxes(file_id: str):
    """
    Get document bounding boxes from the bounding_boxes collection. Just have to return the "pages" attribute
    
    - **file_id**: The MongoDB ObjectId of the document to get bounding boxes for
    """
    logger.info(f"Get document bounding boxes request received for file_id: {file_id}")
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(file_id)
        except Exception:
            logger.warning(f"Invalid file ID format: {file_id}")
            raise HTTPException(
                status_code=400,
                detail="Invalid file ID format"
            )
        
        # Get database connection
        logger.debug("Connecting to database")
        db, _ = get_database()
        
        # Search for document with matching _id in bounding_boxes collection
        collection = db['bounding_boxes']
        
        correct_document = None
        for document in collection.find():
            if document['pdf_file_id'] == file_id:
                correct_document = document
                break
        
        if not correct_document:
            logger.warning(f"Document not found for file_id: {file_id}")
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )
        
        return correct_document.get("pages")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving document bounding boxes for {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving document bounding boxes: {str(e)}"
        )

@router.get("/document/{file_id}/metadata")
async def get_document_metadata(file_id: str):
    """
    Get document metadata from the bounding_boxes collection.
    
    - **file_id**: The MongoDB ObjectId of the document to get metadata for
    """
    logger.info(f"Get document metadata request received for file_id: {file_id}")
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(file_id)
        except Exception:
            logger.warning(f"Invalid file ID format: {file_id}")
            raise HTTPException(
                status_code=400,
                detail="Invalid file ID format"
            )
        
        # Get database connection
        logger.debug("Connecting to database")
        db, _ = get_database()
        
        # Search for document with matching _id in bounding_boxes collection
        collection = db['bounding_boxes']
        
        correct_document = None
        # NOTE/TODO: reason why i had to do this goofy loop shit is because the find_one was buggin
        for document in collection.find():
            if document['pdf_file_id'] == file_id:
                correct_document = document
                break
        
        if not correct_document:
            logger.warning(f"Document not found for file_id: {file_id}")
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )

        # convert correct_document to json
        return {
            "pages": correct_document.get("pages"),
            "full_text": correct_document.get("full_text"),
            "filename": correct_document.get("filename"),
            "pdf_file_id": correct_document.get("pdf_file_id"),
            "images": correct_document.get("images"),
            "summary": correct_document.get("summary"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving document metadata for {file_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving document metadata: {str(e)}"
        )