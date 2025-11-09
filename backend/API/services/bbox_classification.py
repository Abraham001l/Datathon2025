"""Bounding box classification service using ToP Agent."""
import logging
import re
from typing import List, Dict, Any, Optional
from services.database import get_database
from services.top_agent import get_top_agent

logger = logging.getLogger(__name__)

# Category mapping
CATEGORY_NAMES = {
    0: "sensitive",
    1: "confidential",
    2: "public",
    3: "unsafe"
}


def parse_top_agent_response(response: Dict[str, str]) -> Dict[str, Any]:
    """Parse ToP Agent response to extract classification, confidence, and explanation.
    
    Args:
        response: Dictionary with prompt_X/response_X keys from ToP Agent
        
    Returns:
        Dictionary with classification (string), confidence (float), explanation (string)
    """
    classification = "public"  # Default
    confidence = 0.0
    explanation = ""
    
    try:
        # Find all response keys
        response_keys = [key for key in response.keys() if key.startswith("response_")]
        if not response_keys:
            logger.warning("No response keys found in ToP Agent response")
            return {"classification": classification, "confidence": confidence, "explanation": explanation}
        
        # Extract category from first response (response_0)
        first_response = response.get("response_0", "")
        if first_response:
            # Look for "Classification: X" pattern
            classification_match = re.search(r"Classification:\s*(\d+)", first_response, re.IGNORECASE)
            if classification_match:
                category_num = int(classification_match.group(1))
                if 0 <= category_num <= 3:
                    classification = CATEGORY_NAMES.get(category_num, "public")
                else:
                    logger.warning(f"Invalid category number: {category_num}, defaulting to public")
            else:
                # Try to find any single digit 0-3 in the response
                for word in first_response.split():
                    if word.isdigit():
                        category_num = int(word)
                        if 0 <= category_num <= 3:
                            classification = CATEGORY_NAMES.get(category_num, "public")
                            break
        
        # Extract confidence and explanation from last response
        # Sort response keys to get the last one
        response_nums = [int(key.split("_")[1]) for key in response_keys]
        if response_nums:
            last_response_num = max(response_nums)
            last_response_key = f"response_{last_response_num}"
            last_response = response.get(last_response_key, "")
            
            if last_response:
                # Parse confidence
                confidence_match = re.search(r"Confidence:\s*([\d.]+)", last_response, re.IGNORECASE)
                if confidence_match:
                    try:
                        confidence = float(confidence_match.group(1))
                        # Clamp to 0.0-1.0 range
                        confidence = max(0.0, min(1.0, confidence))
                    except ValueError:
                        logger.warning(f"Invalid confidence value: {confidence_match.group(1)}")
                        confidence = 0.0
                else:
                    # Try to find decimal number after "Confidence"
                    confidence_match = re.search(r"Confidence[:\s]+([\d.]+)", last_response, re.IGNORECASE)
                    if confidence_match:
                        try:
                            confidence = float(confidence_match.group(1))
                            confidence = max(0.0, min(1.0, confidence))
                        except ValueError:
                            confidence = 0.0
                
                # Parse explanation
                explanation_match = re.search(r"Explanation:\s*(.+?)(?:\n\n|\nYes/No:|\nConfidence:|$)", last_response, re.IGNORECASE | re.DOTALL)
                if explanation_match:
                    explanation = explanation_match.group(1).strip()
                else:
                    # Try simpler pattern - everything after "Explanation:"
                    explanation_match = re.search(r"Explanation:\s*(.+)$", last_response, re.IGNORECASE | re.DOTALL)
                    if explanation_match:
                        explanation = explanation_match.group(1).strip()
                    else:
                        # Look for explanation in a different format
                        lines = last_response.split("\n")
                        in_explanation = False
                        explanation_lines = []
                        for line in lines:
                            if "Explanation:" in line or "explanation:" in line:
                                in_explanation = True
                                # Get text after "Explanation:"
                                parts = line.split(":", 1)
                                if len(parts) > 1:
                                    explanation_lines.append(parts[1].strip())
                            elif in_explanation:
                                # Stop if we hit another section
                                if any(keyword in line.lower() for keyword in ["yes/no:", "confidence:", "classification:"]):
                                    break
                                explanation_lines.append(line.strip())
                        if explanation_lines:
                            explanation = " ".join(explanation_lines).strip()
        
    except Exception as e:
        logger.error(f"Error parsing ToP Agent response: {str(e)}", exc_info=True)
        # Return defaults
        return {"classification": classification, "confidence": confidence, "explanation": explanation}
    
    return {
        "classification": classification,
        "confidence": confidence,
        "explanation": explanation
    }


def get_bounding_boxes_by_file_id(pdf_file_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve bounding boxes document from database by pdf_file_id.
    
    Args:
        pdf_file_id: The PDF file ID
        
    Returns:
        Bounding boxes document or None if not found
    """
    try:
        db, _ = get_database()
        collection = db['bounding_boxes']
        
        # Find document by pdf_file_id
        document = collection.find_one({'pdf_file_id': pdf_file_id})
        return document
        
    except Exception as e:
        logger.error(f"Error retrieving bounding boxes for file_id {pdf_file_id}: {str(e)}", exc_info=True)
        return None


def update_bounding_box_classifications(
    pdf_file_id: str,
    classifications: List[Dict[str, Any]]
) -> bool:
    """Update bounding boxes in database with classification results.
    
    Args:
        pdf_file_id: The PDF file ID
        classifications: List of classification dicts, each with:
            - bbox_id: ID of the bounding box
            - page_index: Index of the page (0-based)
            - classification: Classification category (string)
            - confidence: Confidence score (float)
            - explanation: Explanation text (string)
            
    Returns:
        True if update successful, False otherwise
    """
    try:
        db, _ = get_database()
        collection = db['bounding_boxes']
        
        # Get the document
        document = collection.find_one({'pdf_file_id': pdf_file_id})
        if not document:
            logger.error(f"Document not found for pdf_file_id: {pdf_file_id}")
            return False
        
        # Create a map of (page_index, bbox_id) -> classification data
        classification_map = {}
        for cls in classifications:
            key = (cls['page_index'], cls['bbox_id'])
            classification_map[key] = cls
        
        # Update pages and bounding_boxes
        pages = document.get('pages', [])
        updated = False
        
        for page_idx, page in enumerate(pages):
            bounding_boxes = page.get('bounding_boxes', [])
            for bbox_idx, bbox in enumerate(bounding_boxes):
                bbox_id = bbox.get('id')
                if bbox_id:
                    # Ensure bbox_id is a string for consistent comparison
                    bbox_id_str = str(bbox_id)
                    key = (page_idx, bbox_id_str)
                    if key in classification_map:
                        cls_data = classification_map[key]
                        # Update the bounding box
                        bbox['classification'] = cls_data['classification']
                        bbox['confidence'] = cls_data['confidence']
                        bbox['explanation'] = cls_data['explanation']
                        updated = True
        
        if updated:
            # Update the document in database
            result = collection.update_one(
                {'pdf_file_id': pdf_file_id},
                {'$set': {'pages': pages}}
            )
            if result.modified_count > 0:
                logger.info(f"Updated {len(classifications)} bounding box classifications for pdf_file_id: {pdf_file_id}")
                return True
            else:
                logger.warning(f"No documents modified when updating classifications for pdf_file_id: {pdf_file_id}")
                return False
        else:
            logger.warning(f"No bounding boxes were updated for pdf_file_id: {pdf_file_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating bounding box classifications: {str(e)}", exc_info=True)
        return False


def classify_bounding_boxes(pdf_file_id: str, document_summary: str) -> Dict[str, Any]:
    """Classify all bounding boxes for a PDF using ToP Agent.
    
    Args:
        pdf_file_id: The PDF file ID
        document_summary: The document summary text
        
    Returns:
        Dictionary with classification statistics
    """
    try:
        logger.info(f"Starting classification for pdf_file_id: {pdf_file_id}")
        
        # Retrieve bounding boxes from database
        document = get_bounding_boxes_by_file_id(pdf_file_id)
        if not document:
            logger.error(f"Could not retrieve bounding boxes for pdf_file_id: {pdf_file_id}")
            return {
                "success": False,
                "error": "Could not retrieve bounding boxes",
                "classified_count": 0,
                "total_count": 0
            }
        
        # Extract all bounding box texts
        pages = document.get('pages', [])
        bbox_texts = []
        bbox_metadata = []  # Store (page_index, bbox_id) for each text
        
        for page_idx, page in enumerate(pages):
            bounding_boxes = page.get('bounding_boxes', [])
            for bbox in bounding_boxes:
                bbox_id = bbox.get('id')
                bbox_text = bbox.get('text', '').strip()
                
                # Only classify non-empty texts
                if bbox_text and bbox_id:
                    # Ensure bbox_id is a string for consistent comparison
                    bbox_id_str = str(bbox_id)
                    bbox_texts.append(bbox_text)
                    bbox_metadata.append({
                        'page_index': page_idx,
                        'bbox_id': bbox_id_str
                    })
        
        if not bbox_texts:
            logger.info(f"No bounding box texts to classify for pdf_file_id: {pdf_file_id}")
            return {
                "success": True,
                "classified_count": 0,
                "total_count": 0,
                "message": "No bounding box texts to classify"
            }
        
        logger.info(f"Classifying {len(bbox_texts)} bounding boxes for pdf_file_id: {pdf_file_id}")
        
        # Call ToP Agent to classify all blocks
        top_agent = get_top_agent()
        results = top_agent.run_doc(bbox_texts, document_summary)
        
        # Parse results and prepare classifications
        classifications = []
        successful_count = 0
        failed_count = 0
        
        for i, result in enumerate(results):
            if i >= len(bbox_metadata):
                logger.warning(f"More results than bounding boxes: {i} >= {len(bbox_metadata)}")
                break
            
            metadata = bbox_metadata[i]
            
            # Check if result has error
            if isinstance(result, dict) and 'error' in result:
                logger.warning(f"Error classifying bounding box {metadata['bbox_id']}: {result.get('error')}")
                # Use default values for failed classifications
                classifications.append({
                    'page_index': metadata['page_index'],
                    'bbox_id': metadata['bbox_id'],
                    'classification': 'public',
                    'confidence': 0.0,
                    'explanation': ''
                })
                failed_count += 1
            else:
                # Parse the response
                parsed = parse_top_agent_response(result)
                classifications.append({
                    'page_index': metadata['page_index'],
                    'bbox_id': metadata['bbox_id'],
                    'classification': parsed['classification'],
                    'confidence': parsed['confidence'],
                    'explanation': parsed['explanation']
                })
                successful_count += 1
        
        # Update database with classifications
        update_success = update_bounding_box_classifications(pdf_file_id, classifications)
        
        if update_success:
            logger.info(f"Successfully classified {successful_count} bounding boxes for pdf_file_id: {pdf_file_id}")
            return {
                "success": True,
                "classified_count": successful_count,
                "failed_count": failed_count,
                "total_count": len(bbox_texts)
            }
        else:
            logger.error(f"Failed to update classifications in database for pdf_file_id: {pdf_file_id}")
            return {
                "success": False,
                "error": "Failed to update database",
                "classified_count": successful_count,
                "failed_count": failed_count,
                "total_count": len(bbox_texts)
            }
            
    except Exception as e:
        logger.error(f"Error classifying bounding boxes for pdf_file_id {pdf_file_id}: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "classified_count": 0,
            "total_count": 0
        }

