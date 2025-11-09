"""Image processing service for PDF image extraction and classification."""
import logging
from typing import List, Dict, Any
from fastapi import HTTPException
import fitz  # PyMuPDF
from services.database import get_database
from services.vision import get_vision_client, batch_classify_images_safe_search, parse_safe_search_result

logger = logging.getLogger(__name__)


def extract_images_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract embedded images and their bounding boxes from a PDF using PyMuPDF.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        List of dictionaries containing image metadata, bounding boxes, and image data
    """
    images_data = []
    
    try:
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        logger.debug(f"Extracting images from {page_count} pages")
        
        for page_num in range(page_count):
            page = doc[page_num]
            
            # Get images on page (only embedded images)
            images = page.get_images(full=True)
            if not images:
                continue
            
            logger.debug(f"Page {page_num + 1}: {len(images)} image(s) found")
            
            # Build mapping of xref to bounding boxes
            xref_to_bbox = {}
            try:
                # Get image blocks from page content
                page_dict = page.get_text("dict")
                for block in page_dict.get("blocks", []):
                    if block.get("type") == 1 and "image" in block:  # Type 1 = image block
                        img_data = block["image"]
                        bbox_rect = fitz.Rect(block["bbox"])
                        if "xref" in img_data:
                            xref_to_bbox[img_data["xref"]] = bbox_rect
            except Exception as e:
                logger.debug(f"Error extracting bboxes from page dict: {e}")
            
            # Also try get_image_rects for each xref
            for img_info in images:
                xref = img_info[0]
                if xref not in xref_to_bbox:
                    try:
                        rects = page.get_image_rects(xref)
                        if rects and len(rects) > 0:
                            xref_to_bbox[xref] = rects[0]
                    except Exception:
                        pass
            
            # Extract images
            for img_idx, img in enumerate(images):
                xref = img[0]
                try:
                    # Extract the embedded image data
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Get bounding box if available
                    bbox_dict = None
                    if xref in xref_to_bbox:
                        bbox = xref_to_bbox[xref]
                        bbox_dict = {
                            "x0": round(bbox.x0, 2),
                            "y0": round(bbox.y0, 2),
                            "x1": round(bbox.x1, 2),
                            "y1": round(bbox.y1, 2),
                            "width": round(bbox.width, 2),
                            "height": round(bbox.height, 2)
                        }
                    
                    # Get page dimensions
                    rect = page.rect
                    
                    image_data = {
                        "page": page_num + 1,
                        "image_index": img_idx + 1,
                        "xref": xref,
                        "extension": image_ext,
                        "size_bytes": len(image_bytes),
                        "bounding_box": bbox_dict,
                        "page_width": round(rect.width, 2),
                        "page_height": round(rect.height, 2),
                        "image_bytes": image_bytes  # Store for classification
                    }
                    images_data.append(image_data)
                    
                    logger.debug(f"  Extracted image {img_idx + 1} on page {page_num + 1}: {len(image_bytes)} bytes, {image_ext}")
                    
                except Exception as img_error:
                    logger.warning(f"Failed to extract image {img_idx + 1} (xref={xref}) on page {page_num + 1}: {img_error}")
        
        doc.close()
        logger.info(f"Extracted {len(images_data)} images from PDF")
        
    except Exception as e:
        logger.error(f"Error extracting images from PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting images from PDF: {str(e)}"
        )
    
    return images_data


def classify_images(images_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Classify images with Vision API Safe Search.
    
    Args:
        images_data: List of image data dictionaries
        
    Returns:
        List of image data dictionaries with safe_search classifications added
    """
    if not images_data:
        return images_data
    
    vision_client = get_vision_client()
    if not vision_client:
        logger.warning("Vision API client not available, skipping image classification")
        # Add error to all images
        for img_data in images_data:
            img_data["safe_search"] = parse_safe_search_result(None, "Vision API not available")
        return images_data
    
    logger.info("Classifying images with Google Vision API Safe Search")
    # Extract image bytes for classification
    image_contents = [img["image_bytes"] for img in images_data]
    
    # Batch classify images
    safe_search_results = batch_classify_images_safe_search(
        image_contents,
        vision_client,
        batch_size=16
    )
    
    # Assign classification results to images
    images_classified = 0
    for idx, result in enumerate(safe_search_results):
        if idx < len(images_data):
            images_data[idx]["safe_search"] = result
            if result.get("error") is None:
                images_classified += 1
    
    logger.info(f"Classified {images_classified} of {len(images_data)} images")
    return images_data


def upload_image_bounding_boxes(
    pdf_file_id: str,
    filename: str,
    images_data: List[Dict[str, Any]]
) -> str:
    """
    Upload image bounding boxes and Safe Search classifications to MongoDB.
    
    Args:
        pdf_file_id: The ID of the PDF file in GridFS
        filename: The filename of the PDF
        images_data: List of image data dictionaries with classifications
        
    Returns:
        The ID of the inserted document as string
    """
    logger.debug(f"Uploading image bounding boxes for file: {filename}, pdf_file_id: {pdf_file_id}")
    
    try:
        # Get database instance
        db, _ = get_database()
        logger.debug("Database connection established")
        
        # Prepare image data for storage (remove image_bytes, keep only metadata)
        stored_images = []
        for img_data in images_data:
            stored_img = {
                "page": img_data["page"],
                "image_index": img_data["image_index"],
                "xref": img_data["xref"],
                "extension": img_data["extension"],
                "size_bytes": img_data["size_bytes"],
                "bounding_box": img_data["bounding_box"],
                "page_width": img_data["page_width"],
                "page_height": img_data["page_height"],
                "safe_search": img_data.get("safe_search", {}),
            }
            stored_images.append(stored_img)
        
        # Prepare document
        image_boxes_doc = {
            'pdf_file_id': pdf_file_id,
            'filename': filename,
            'images': stored_images,
            'summary': {
                'total_images': len(stored_images),
                'images_with_bbox': sum(1 for img in stored_images if img.get('bounding_box')),
                'images_classified': sum(1 for img in stored_images if img.get('safe_search') and not img.get('safe_search', {}).get('error'))
            },
        }
        
        logger.debug("Storing image bounding boxes in MongoDB collection")
        # Store in MongoDB collection
        image_boxes_collection = db['bounding_boxes_img']
        
        # Delete any existing image bounding boxes for this filename first
        delete_result = image_boxes_collection.delete_one({'filename': filename})
        if delete_result.deleted_count > 0:
            logger.debug(f"Deleted existing image bounding boxes document for filename: {filename}")
        
        # Insert new document
        result = image_boxes_collection.insert_one(image_boxes_doc)
        if not result.inserted_id:
            raise ValueError(f"Failed to insert image bounding boxes document for filename: {filename}")
        
        image_boxes_id = str(result.inserted_id)
        logger.info(f"Image bounding boxes uploaded successfully for file: {filename}, image_boxes_id: {image_boxes_id}")
        return image_boxes_id
        
    except Exception as e:
        logger.error(f"Error uploading image bounding boxes for {filename}: {str(e)}", exc_info=True)
        raise

