import os
import json
import re
import tempfile
import shutil
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from io import BytesIO
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from google.cloud import documentai
from google.api_core import exceptions as google_exceptions
import sys
try:
    from PyPDF2 import PdfReader, PdfWriter  # PyPDF2 (standard import)
except ImportError:
    from pypdf import PdfReader, PdfWriter  # Alternative import name
from pdfparse import extract_text_with_boxes

# Add parent directory to path to import from routes
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

# Import upload functions from upload.py
from routes.upload import upload_file_to_gridfs, upload_bounding_boxes

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/parse", tags=["parse"])


def get_document_ai_client():
    """Initialize and return Document AI client."""
    logger.debug("Initializing Document AI client")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path or not os.path.exists(credentials_path):
        logger.error(f"GOOGLE_APPLICATION_CREDENTIALS not configured properly: {credentials_path}")
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_APPLICATION_CREDENTIALS not configured properly"
        )
    
    try:
        client = documentai.DocumentProcessorServiceClient()
        logger.debug("Document AI client initialized successfully")
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Document AI client: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Document AI client: {str(e)}"
        )


def get_pdf_page_count(pdf_content: bytes) -> int:
    """Get the number of pages in a PDF."""
    try:
        pdf_reader = PdfReader(BytesIO(pdf_content))
        return len(pdf_reader.pages)
    except Exception as e:
        logger.error(f"Error reading PDF page count: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid PDF file: {str(e)}"
        )


def split_pdf(pdf_content: bytes, chunk_size: int = 15) -> List[bytes]:
    """Split a PDF into chunks of at most chunk_size pages."""
    try:
        pdf_reader = PdfReader(BytesIO(pdf_content))
        total_pages = len(pdf_reader.pages)
        
        if total_pages <= chunk_size:
            return [pdf_content]
        
        chunks = []
        for start_page in range(0, total_pages, chunk_size):
            end_page = min(start_page + chunk_size, total_pages)
            pdf_writer = PdfWriter()
            
            for page_num in range(start_page, end_page):
                pdf_writer.add_page(pdf_reader.pages[page_num])
            
            chunk_buffer = BytesIO()
            pdf_writer.write(chunk_buffer)
            chunks.append(chunk_buffer.getvalue())
            
            logger.debug(f"Created PDF chunk: pages {start_page + 1} to {end_page} (total: {end_page - start_page} pages)")
        
        logger.info(f"Split PDF into {len(chunks)} chunks")
        return chunks
    except Exception as e:
        logger.error(f"Error splitting PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error splitting PDF: {str(e)}"
        )


def process_pdf_chunk(
    client: documentai.DocumentProcessorServiceClient,
    processor_name: str,
    pdf_chunk: bytes,
    chunk_index: int,
    use_imageless_mode: bool = False
) -> documentai.Document:
    """Process a single PDF chunk with Document AI."""
    try:
        raw_document = documentai.RawDocument(
            content=pdf_chunk,
            mime_type="application/pdf"
        )
        
        if use_imageless_mode:
            try:
                process_options = documentai.ProcessOptions(
                    ocr_config=documentai.OcrConfig(
                        enable_native_pdf_parsing=True,
                        enable_image_quality_scores=False
                    )
                )
                request = documentai.ProcessRequest(
                    name=processor_name,
                    raw_document=raw_document,
                    process_options=process_options
                )
            except Exception:
                request = documentai.ProcessRequest(
                    name=processor_name,
                    raw_document=raw_document
                )
        else:
            request = documentai.ProcessRequest(
                name=processor_name,
                raw_document=raw_document
            )
        
        logger.debug(f"Processing chunk {chunk_index + 1}")
        result = client.process_document(request=request)
        document = result.document
        logger.info(f"Chunk {chunk_index + 1} processed: {len(document.pages)} pages")
        return document
        
    except google_exceptions.InvalidArgument as e:
        error_str = str(e)
        if "PAGE_LIMIT_EXCEEDED" in error_str or "page limit" in error_str.lower():
            logger.error(f"Chunk {chunk_index + 1} still exceeds page limit: {error_str}")
            raise HTTPException(
                status_code=400,
                detail=f"PDF chunk {chunk_index + 1} exceeds processing limit even after splitting. "
                       f"This should not happen with chunks <= 15 pages. Error: {error_str}"
            )
        raise
    except Exception as e:
        logger.error(f"Error processing chunk {chunk_index + 1}: {str(e)}", exc_info=True)
        raise


def merge_extracted_data(chunks_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Merge extracted data from multiple PDF chunks into a single document."""
    if not chunks_data:
        raise ValueError("No chunks data to merge")
    
    merged = {
        'full_text': '',
        'pages': [],
        'images': []
    }
    
    page_offset = 0
    bbox_id_counter = 1  # Counter for reassigning unique IDs across all chunks
    
    for chunk_idx, chunk_data in enumerate(chunks_data):
        # Merge full text with newline separator between chunks
        if chunk_data.get('full_text'):
            if merged['full_text']:
                merged['full_text'] += '\n\n'
            merged['full_text'] += chunk_data.get('full_text', '')
        
        # Merge pages with corrected page numbers and reassign bounding box IDs
        chunk_pages = chunk_data.get('pages', [])
        for page in chunk_pages:
            # Create a copy of the page to avoid modifying the original
            merged_page = page.copy()
            # Update page number to reflect position in full document
            # chunk_page_num is 1-indexed within the chunk
            chunk_page_num = page.get('page_number', 1)
            merged_page['page_number'] = page_offset + chunk_page_num
            
            # Reassign IDs to bounding boxes to ensure uniqueness across all chunks
            text_annotations = merged_page.get('text_annotations', [])
            for annotation in text_annotations:
                annotation['id'] = str(bbox_id_counter)
                bbox_id_counter += 1
            
            merged['pages'].append(merged_page)
        
        # Merge images with corrected page numbers
        chunk_images = chunk_data.get('images', [])
        for image in chunk_images:
            # Create a copy of the image to avoid modifying the original
            merged_image = image.copy()
            # Update page number to reflect position in full document
            image_page = image.get('page_number', 1)
            merged_image['page_number'] = page_offset + image_page
            merged['images'].append(merged_image)
        
        # Update page offset for next chunk
        page_offset += len(chunk_pages)
    
    logger.info(f"Merged {len(chunks_data)} chunks into {len(merged['pages'])} pages, {len(merged['images'])} images")
    return merged


@router.post("/parse-pdf")
async def upload_and_process_pdf(
    file: UploadFile = File(...),
    processor_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    status: Optional[str] = Form("pending_classification"),
    ai_classified_sensitivity: Optional[str] = Form("unclassified")
):
    """Upload a PDF, process it with Document AI, and store both the PDF and bounding boxes in MongoDB."""
    logger.info(f"PDF parse request received - filename: {file.filename}, content_type: {file.content_type}")
    temp_dir = None
    
    try:
        # Validate filename
        if not file.filename:
            logger.error("No filename provided in upload request")
            raise HTTPException(status_code=400, detail="Filename is required")
        
        if not file.filename.endswith('.pdf'):
            logger.warning(f"Invalid file type: {file.filename}")
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Validate processor name
        processor_name = processor_name or os.getenv("DOCUMENT_AI_PROCESSOR_NAME")
        if not processor_name:
            logger.error("Processor name not provided")
            raise HTTPException(
                status_code=400,
                detail="Processor name not provided. Set DOCUMENT_AI_PROCESSOR_NAME in .env or provide processor_name parameter"
            )
        logger.debug(f"Using processor: {processor_name}")
        
        # Create temporary directory for processing
        temp_dir = tempfile.mkdtemp()
        logger.debug(f"Created temporary directory: {temp_dir}")
        
        # Save uploaded file temporarily
        pdf_path = Path(temp_dir) / file.filename
        logger.debug(f"Saving uploaded file to: {pdf_path}")
        with open(pdf_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        logger.info(f"File saved temporarily: {file.filename}")
        
        # Read PDF content for processing and storage
        logger.debug("Reading PDF content")
        with open(pdf_path, "rb") as pdf_file:
            pdf_content = pdf_file.read()
        logger.info(f"PDF content read: {len(pdf_content)} bytes")
        
        # Check page count and determine if splitting is needed
        page_count = get_pdf_page_count(pdf_content)
        logger.info(f"PDF has {page_count} pages")
        
        MAX_PAGES_PER_CHUNK = 15
        client = get_document_ai_client()
        
        # Process PDF (split if necessary)
        if page_count > MAX_PAGES_PER_CHUNK:
            logger.info(f"PDF exceeds {MAX_PAGES_PER_CHUNK} pages, splitting into chunks")
            
            # Split PDF into chunks
            pdf_chunks = split_pdf(pdf_content, chunk_size=MAX_PAGES_PER_CHUNK)
            logger.info(f"Split into {len(pdf_chunks)} chunks for processing")
            
            # Process each chunk
            chunks_data = []
            for chunk_idx, pdf_chunk in enumerate(pdf_chunks):
                logger.info(f"Processing chunk {chunk_idx + 1} of {len(pdf_chunks)}")
                try:
                    document = process_pdf_chunk(
                        client=client,
                        processor_name=processor_name,
                        pdf_chunk=pdf_chunk,
                        chunk_index=chunk_idx,
                        use_imageless_mode=False  # Not needed for chunks <= 15 pages
                    )
                    
                    # Extract data from this chunk
                    chunk_data = extract_text_with_boxes(document)
                    chunks_data.append(chunk_data)
                    logger.info(f"Chunk {chunk_idx + 1} processed: {len(chunk_data.get('pages', []))} pages")
                    
                except Exception as chunk_error:
                    logger.error(f"Error processing chunk {chunk_idx + 1}: {str(chunk_error)}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error processing PDF chunk {chunk_idx + 1} of {len(pdf_chunks)}: {str(chunk_error)}"
                    )
            
            # Merge all chunks
            logger.info("Merging extracted data from all chunks")
            extracted_data = merge_extracted_data(chunks_data)
            logger.info(f"Merged data: {len(extracted_data.get('pages', []))} pages, {len(extracted_data.get('images', []))} images")
            
        else:
            # Process normally (single request) - document is <= 15 pages
            logger.info("Processing PDF as single document (no splitting needed)")
            try:
                document = process_pdf_chunk(
                    client=client,
                    processor_name=processor_name,
                    pdf_chunk=pdf_content,
                    chunk_index=0,
                    use_imageless_mode=False  # Not needed for documents <= 15 pages
                )
                
                # Extract text and bounding boxes
                logger.debug("Extracting text and bounding boxes")
                extracted_data = extract_text_with_boxes(document)
                logger.info(f"Extracted data: {len(extracted_data.get('pages', []))} pages, {len(extracted_data.get('images', []))} images")
                
            except google_exceptions.InvalidArgument as docai_error:
                # If we get a page limit error on a small document, something is wrong
                error_str = str(docai_error)
                if "PAGE_LIMIT_EXCEEDED" in error_str or "page limit" in error_str.lower():
                    logger.error(f"Unexpected page limit error for {page_count} page document: {error_str}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Document processing failed: {error_str}"
                    )
                raise
            except Exception as docai_error:
                logger.error(f"Error processing PDF: {str(docai_error)}", exc_info=True)
                raise
        
        # Clean up temporary data
        if '_image_elements' in extracted_data:
            del extracted_data['_image_elements']
        
        # Upload PDF to GridFS using upload_file_to_gridfs
        logger.info("Uploading PDF to GridFS")
        pdf_file_id, is_update = await upload_file_to_gridfs(
            file_contents=pdf_content,
            filename=file.filename,
            content_type=file.content_type or "application/pdf",
            description=description,
            category=category,
            status=status,
            ai_classified_sensitivity=ai_classified_sensitivity
        )
        logger.info(f"PDF uploaded to GridFS: file_id={pdf_file_id}, updated={is_update}")
        
        # Upload bounding boxes using upload_bounding_boxes
        logger.info("Uploading bounding boxes to MongoDB")
        bounding_boxes_id = upload_bounding_boxes(
            pdf_file_id=pdf_file_id,
            filename=file.filename,
            extracted_data=extracted_data
        )
        logger.info(f"Bounding boxes uploaded: bounding_boxes_id={bounding_boxes_id}")
        
        # Get summary from extracted_data
        was_split = page_count > MAX_PAGES_PER_CHUNK
        summary = {
            'total_pages': len(extracted_data.get('pages', [])),
            'total_text_annotations': sum(len(p.get('text_annotations', [])) for p in extracted_data.get('pages', [])),
            'total_images': len(extracted_data.get('images', [])),
            'full_text_length': len(extracted_data.get('full_text', '')),
            'was_split': was_split,
            'original_page_count': page_count
        }
        logger.info(f"Processing complete - Summary: {summary}")
        
        return JSONResponse(
            status_code=201,
            content={
                "message": "PDF processed and uploaded successfully",
                "pdf_file_id": pdf_file_id,
                "bounding_boxes_id": bounding_boxes_id,
                "filename": file.filename,
                "summary": summary
            }
        )
    
    except HTTPException as e:
        logger.error(f"HTTP error processing PDF: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Error processing PDF {file.filename if file else 'unknown'}: {str(e)}", exc_info=True)
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Exception args: {e.args}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing PDF: {str(e)}"
        )
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            logger.debug(f"Cleaning up temporary directory: {temp_dir}")
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as cleanup_error:
                logger.warning(f"Error cleaning up temp directory: {cleanup_error}")


