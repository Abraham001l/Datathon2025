"""PDF parsing route handler."""
import os
import tempfile
import shutil
import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from google.api_core import exceptions as google_exceptions
import sys

# Add parent directory to path to import from routes
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

# Import services
from services.llm import generate_document_summary
from services.document_ai import get_document_ai_client, process_pdf_chunk
from services.document_parser import extract_text_with_boxes
from services.pdf_utils import get_pdf_page_count, split_pdf, merge_extracted_data
from services.images import extract_images_from_pdf, classify_images, upload_image_bounding_boxes
from services.bbox_classification import classify_bounding_boxes
from services.bbox_combiner import combine_bounding_boxes
from routes.upload import upload_file_to_gridfs, upload_bounding_boxes

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/parse", tags=["parse"])


@router.post("/parse-pdf")
async def upload_and_process_pdf(
    background_tasks: BackgroundTasks,
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
        
        # Combine small bounding boxes into larger ones
        logger.info("Combining small bounding boxes")
        try:
            extracted_data = combine_bounding_boxes(extracted_data)
            logger.info("Bounding box combination completed")
        except Exception as combine_error:
            logger.error(f"Error combining bounding boxes: {str(combine_error)}", exc_info=True)
            # Continue processing even if combination fails
            logger.warning("Continuing with original bounding boxes despite combination error")
        
        # Generate document summary using Vultr LLM (required for parsed PDFs)
        logger.info("=== Starting Document Summary Generation ===")
        document_summary = None
        full_text = extracted_data.get('full_text', '')
        
        if full_text:
            text_length = len(full_text)
            text_word_count = len(full_text.split())
            logger.info(f"Extracted text length: {text_length} characters, {text_word_count} words")
            logger.info(f"Preparing to generate summary from extracted text")
            
            try:
                document_summary = generate_document_summary(full_text)
                if document_summary:
                    summary_length = len(document_summary)
                    summary_word_count = len(document_summary.split())
                    logger.info(f"=== Document Summary Generation Successful ===")
                    logger.info(f"Generated summary length: {summary_length} characters, {summary_word_count} words")
                    logger.info(f"Summary compression ratio: {text_length/summary_length:.2f}:1 (original:summary)")
                else:
                    logger.error("Summary generation returned empty result")
            except Exception as summary_error:
                logger.error(f"=== Document Summary Generation Failed ===")
                logger.error(f"Failed to generate summary: {str(summary_error)}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate document summary: {str(summary_error)}"
                )
        else:
            logger.error("No text extracted from PDF, cannot generate summary")
            raise HTTPException(
                status_code=500,
                detail="No text content extracted from PDF, cannot generate summary"
            )
        
        # Validate that summary was generated
        if not document_summary or not document_summary.strip():
            logger.error("Summary validation failed: empty summary returned")
            raise HTTPException(
                status_code=500,
                detail="Summary generation failed: empty summary returned"
            )
        
        logger.info(f"Document summary validated successfully - Ready for storage and classification")
        
        # Upload PDF to GridFS using upload_file_to_gridfs
        # Description is optional (user-provided), summary is required (generated)
        logger.info("Uploading PDF to GridFS with document summary")
        logger.info(f"Storing summary ({len(document_summary)} chars) with PDF file: {file.filename}")
        pdf_file_id, is_update = await upload_file_to_gridfs(
            file_contents=pdf_content,
            filename=file.filename,
            content_type=file.content_type or "application/pdf",
            description=description,  # Optional user-provided description
            category=category,
            status=status,
            ai_classified_sensitivity=ai_classified_sensitivity,
            summary=document_summary  # Required generated summary
        )
        logger.info(f"PDF uploaded to GridFS: file_id={pdf_file_id}, updated={is_update}")
        logger.info(f"Document summary stored successfully with PDF (file_id: {pdf_file_id})")
        
        # Upload bounding boxes using upload_bounding_boxes
        logger.info("Uploading bounding boxes to MongoDB")
        bounding_boxes_id = upload_bounding_boxes(
            pdf_file_id=pdf_file_id,
            filename=file.filename,
            extracted_data=extracted_data
        )
        logger.info(f"Bounding boxes uploaded: bounding_boxes_id={bounding_boxes_id}")
        
        # Schedule bounding box classification to run asynchronously in the background
        logger.info("Scheduling bounding box classification to run asynchronously")
        logger.info(f"Passing document summary ({len(document_summary)} chars) to classification task for pdf_file_id: {pdf_file_id}")
        background_tasks.add_task(classify_bounding_boxes, pdf_file_id, document_summary)
        logger.info(f"Background classification task scheduled with document summary")
        
        # Extract and process images from PDF
        image_boxes_id = None
        images_extracted = 0
        images_classified = 0
        try:
            logger.info("Extracting images from PDF")
            images_data = extract_images_from_pdf(str(pdf_path))
            images_extracted = len(images_data)
            logger.info(f"Extracted {images_extracted} images from PDF")
            
            # Classify images with Vision API Safe Search if available
            if images_data:
                images_data = classify_images(images_data)
                images_classified = sum(1 for img in images_data if img.get("safe_search", {}).get("error") is None)
                
                # Upload image bounding boxes and classifications
                logger.info("Uploading image bounding boxes to MongoDB")
                image_boxes_id = upload_image_bounding_boxes(
                    pdf_file_id=pdf_file_id,
                    filename=file.filename,
                    images_data=images_data
                )
                logger.info(f"Image bounding boxes uploaded: image_boxes_id={image_boxes_id}")
            else:
                logger.info("No images found in PDF")
        except Exception as img_error:
            logger.error(f"Error processing images: {str(img_error)}", exc_info=True)
            # Don't fail the entire request if image processing fails
            logger.warning("Continuing despite image processing error")
        
        # Get summary from extracted_data
        was_split = page_count > MAX_PAGES_PER_CHUNK
        summary = {
            'total_pages': len(extracted_data.get('pages', [])),
            'total_text_annotations': sum(len(p.get('text_annotations', [])) for p in extracted_data.get('pages', [])),
            'total_images': len(extracted_data.get('images', [])),
            'full_text_length': len(extracted_data.get('full_text', '')),
            'was_split': was_split,
            'original_page_count': page_count,
            'images_extracted': images_extracted,
            'images_classified': images_classified
        }
        logger.info(f"Processing complete - Summary: {summary}")
        
        response_content = {
            "message": "PDF processed and uploaded successfully",
            "pdf_file_id": pdf_file_id,
            "bounding_boxes_id": bounding_boxes_id,
            "filename": file.filename,
            "summary": summary
        }
        
        if image_boxes_id:
            response_content["image_boxes_id"] = image_boxes_id
        
        return JSONResponse(
            status_code=201,
            content=response_content
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
