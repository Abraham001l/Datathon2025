import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import sys
from pathlib import Path

# Add parent directory to path to import database
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))
from database import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])


async def upload_file_to_gridfs(
    file_contents: bytes,
    filename: str,
    content_type: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = "pending_classification",
    ai_classified_sensitivity: Optional[str] = None
) -> tuple[str, bool]:
    """
    Upload file contents to GridFS. If a file with the same filename exists, it will be updated.
    
    Args:
        file_contents: The file contents as bytes
        filename: The filename (required, cannot be empty)
        content_type: Optional content type
        description: Optional description of the document
        category: Optional category classification
        status: Document status (default: "pending_classification")
        ai_classified_sensitivity: AI classification (default: "unclassified")
    
    Returns:
        Tuple of (file_id as string, is_update as bool)
    
    Raises:
        ValueError: If filename is None or empty
    """
    # Validate filename
    if not filename or not filename.strip():
        raise ValueError("Filename is required and cannot be empty")
    
    # Get database and GridFS instance
    logger.debug("Connecting to database")
    db, fs = get_database()
    
    # Check if file with same filename exists
    existing_file = fs.find_one({"filename": filename})
    is_update = existing_file is not None
    
    if is_update:
        logger.info(f"File with filename '{filename}' already exists. Updating...")
        # Delete the old file
        fs.delete(existing_file._id)
        logger.debug(f"Deleted old file with id: {existing_file._id}")
    
    # Prepare metadata
    metadata = {
        "filename": filename,
        "content_type": content_type or "application/octet-stream"
    }
    
    if description:
        metadata["description"] = description
    if category:
        metadata["category"] = category
    if status:
        metadata["status"] = status
    if ai_classified_sensitivity:
        metadata["ai_classified_sensitivity"] = ai_classified_sensitivity
    
    logger.debug(f"Uploading file to GridFS with metadata: {metadata}")
    # Store file in GridFS
    file_id = fs.put(
        file_contents,
        **metadata
    )
    
    action = "updated" if is_update else "uploaded"
    logger.info(f"File {action} successfully: {filename}, file_id: {file_id}")
    return str(file_id), is_update


def upload_bounding_boxes(
    pdf_file_id: str,
    filename: str,
    extracted_data: Dict[str, Any]
) -> str:
    """
    Upload bounding boxes data to MongoDB collection.
    
    Args:
        pdf_file_id: The ID of the PDF file in GridFS
        filename: The filename of the PDF
        extracted_data: Dictionary containing extracted data with 'pages', 'full_text', 'images' keys
    
    Returns:
        The ID of the inserted bounding boxes document as string
    
    Raises:
        ValueError: If extracted_data is missing required keys
        Exception: For database errors
    """
    logger.debug(f"Uploading bounding boxes for file: {filename}, pdf_file_id: {pdf_file_id}")
    
    try:
        # Validate extracted_data structure
        if not isinstance(extracted_data, dict):
            raise ValueError(f"extracted_data must be a dict, got {type(extracted_data)}")
        
        if 'pages' not in extracted_data:
            raise ValueError("extracted_data is missing 'pages' key")
        if 'full_text' not in extracted_data:
            logger.warning("extracted_data is missing 'full_text' key, using empty string")
            extracted_data['full_text'] = ''
        if 'images' not in extracted_data:
            logger.warning("extracted_data is missing 'images' key, using empty list")
            extracted_data['images'] = []
        
        logger.debug(f"Processing {len(extracted_data['pages'])} pages for bounding boxes")
        
        # Get database instance
        db, _ = get_database()
        logger.debug("Database connection established")
        
        # Prepare bounding boxes data for storage
        pages_data = []
        for page_idx, page_data in enumerate(extracted_data['pages']):
            try:
                page_num = page_data.get('page_number', page_idx + 1)
                
                # Get page text
                text_annotations = page_data.get('text_annotations', [])
                block_texts = [ann['text'] for ann in text_annotations if ann.get('type') == 'block' and ann.get('text')]
                if block_texts:
                    page_text = "\n".join(block_texts)
                else:
                    page_text = "\n".join([ann['text'] for ann in text_annotations if ann.get('text')])
                
                pages_data.append({
                    'page_number': page_num,
                    'text': page_text,
                    'bounding_boxes': text_annotations,
                    'dimensions': page_data.get('dimension', {})
                })
            except Exception as e:
                logger.error(f"Error processing page {page_idx}: {str(e)}", exc_info=True)
                raise
        
        logger.debug(f"Processed {len(pages_data)} pages")
        
        # Prepare bounding boxes document
        bounding_boxes_doc = {
            'pdf_file_id': pdf_file_id,
            'filename': filename,
            'full_text': extracted_data.get('full_text', ''),
            'pages': pages_data,
            'images': extracted_data.get('images', []),
            'summary': {
                'total_pages': len(extracted_data['pages']),
                'total_text_annotations': sum(len(p.get('text_annotations', [])) for p in extracted_data['pages']),
                'total_images': len(extracted_data.get('images', [])),
                'full_text_length': len(extracted_data.get('full_text', ''))
            }
        }
        
        logger.debug("Storing bounding boxes in MongoDB collection")
        # Store bounding boxes in MongoDB collection
        bounding_boxes_collection = db['bounding_boxes']
        
        # Update or insert bounding boxes document (upsert based on filename)
        result = bounding_boxes_collection.update_one(
            {'filename': filename},
            {'$set': bounding_boxes_doc},
            upsert=True
        )
        
        # Get the document ID
        bounding_boxes_doc_db = bounding_boxes_collection.find_one({'filename': filename})
        if not bounding_boxes_doc_db:
            raise ValueError(f"Failed to retrieve bounding boxes document for filename: {filename}")
        
        bounding_boxes_id = str(bounding_boxes_doc_db['_id'])
        logger.info(f"Bounding boxes uploaded successfully for file: {filename}, bounding_boxes_id: {bounding_boxes_id}")
        return bounding_boxes_id
        
    except ValueError as e:
        logger.error(f"Validation error in upload_bounding_boxes: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error uploading bounding boxes for {filename}: {str(e)}", exc_info=True)
        logger.error(f"Exception type: {type(e).__name__}")
        raise


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    status: Optional[str] = Form("pending_classification"),
    ai_classified_sensitivity: Optional[str] = Form("unclassified")
):
    """
    Upload a document to GridFS. If a file with the same filename exists, it will be updated.
    
    - **file**: The file to upload (PDF, etc.) - filename is required
    - **description**: Optional description of the document
    - **category**: Optional category classification
    - **status**: Document status (default: "pending_classification")
    - **ai_classified_sensitivity**: AI classification (default: "unclassified")
    """
    # Validate filename
    if not file.filename or not file.filename.strip():
        logger.error("Upload request received with empty filename")
        raise HTTPException(
            status_code=400,
            detail="Filename is required and cannot be empty"
        )
    
    logger.info(f"Upload request received for file: {file.filename}, content_type: {file.content_type}")
    try:
        # Read file contents
        logger.debug(f"Reading file contents for: {file.filename}")
        file_contents = await file.read()
        file_size = len(file_contents)
        logger.info(f"File read successfully: {file.filename}, size: {file_size} bytes")
        
        # Upload to GridFS
        file_id, is_update = await upload_file_to_gridfs(
            file_contents=file_contents,
            filename=file.filename,
            content_type=file.content_type,
            description=description,
            category=category,
            status=status,
            ai_classified_sensitivity=ai_classified_sensitivity
        )
        
        # Prepare metadata for response
        metadata = {
            "filename": file.filename,
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
        
        message = "File updated successfully" if is_update else "File uploaded successfully"
        status_code = 200 if is_update else 201
        
        return JSONResponse(
            status_code=status_code,
            content={
                "message": message,
                "file_id": file_id,
                "filename": file.filename,
                "updated": is_update,
                "metadata": metadata
            }
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading file {file.filename}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading file: {str(e)}"
        )

