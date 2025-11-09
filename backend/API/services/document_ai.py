"""Document AI service for PDF processing."""
import os
import logging
from typing import Optional
from fastapi import HTTPException
from google.cloud import documentai
from google.api_core import exceptions as google_exceptions
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def get_document_ai_client() -> documentai.DocumentProcessorServiceClient:
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

