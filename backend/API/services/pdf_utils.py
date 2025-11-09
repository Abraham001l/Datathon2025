"""PDF utilities for splitting and processing."""
import logging
from typing import List, Dict, Any
from io import BytesIO
from fastapi import HTTPException
from PyPDF2 import PdfReader, PdfWriter

logger = logging.getLogger(__name__)


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

