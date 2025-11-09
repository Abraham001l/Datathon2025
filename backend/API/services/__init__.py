"""Services module for PDF parsing functionality."""

# Database service
from services.database import get_database, verify_connection, close_database

# Document AI service
from services.document_ai import get_document_ai_client, process_pdf_chunk

# Document parser service
from services.document_parser import extract_text_with_boxes

# Vision API service
from services.vision import get_vision_client, batch_classify_images_safe_search

# Image processing service
from services.images import extract_images_from_pdf, classify_images, upload_image_bounding_boxes

# PDF utilities
from services.pdf_utils import get_pdf_page_count, split_pdf, merge_extracted_data

# LLM service
from services.llm import generate_document_summary, VultrLLM

# ToP Agent service
from services.top_agent import get_top_agent, ToP_Agent

# Bounding box classification service
from services.bbox_classification import (
    classify_bounding_boxes,
    parse_top_agent_response,
    get_bounding_boxes_by_file_id,
    update_bounding_box_classifications
)

__all__ = [
    # Database
    'get_database',
    'verify_connection',
    'close_database',
    # Document AI
    'get_document_ai_client',
    'process_pdf_chunk',
    # Document parser
    'extract_text_with_boxes',
    # Vision API
    'get_vision_client',
    'batch_classify_images_safe_search',
    # Images
    'extract_images_from_pdf',
    'classify_images',
    'upload_image_bounding_boxes',
    # PDF utils
    'get_pdf_page_count',
    'split_pdf',
    'merge_extracted_data',
    # LLM
    'generate_document_summary',
    'VultrLLM',
    # ToP Agent
    'get_top_agent',
    'ToP_Agent',
    # Bounding box classification
    'classify_bounding_boxes',
    'parse_top_agent_response',
    'get_bounding_boxes_by_file_id',
    'update_bounding_box_classifications',
]

