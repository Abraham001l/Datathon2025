"""Bounding box combination service for merging small boxes into larger ones."""
import logging
from typing import List, Dict, Any, Tuple
from math import sqrt

logger = logging.getLogger(__name__)


def get_bbox_bounds(bbox: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """Extract bounding box bounds (min_x, min_y, max_x, max_y) from vertices.
    
    Args:
        bbox: Bounding box dict with 'vertices' key containing list of {'x', 'y'} dicts
        
    Returns:
        Tuple of (min_x, min_y, max_x, max_y)
    """
    vertices = bbox.get('vertices', [])
    if not vertices:
        return (0.0, 0.0, 0.0, 0.0)
    
    xs = [v.get('x', 0.0) for v in vertices]
    ys = [v.get('y', 0.0) for v in vertices]
    
    return (min(xs), min(ys), max(xs), max(ys))


def get_bbox_area(bbox: Dict[str, Any]) -> float:
    """Calculate area of a bounding box.
    
    Args:
        bbox: Bounding box dict with 'vertices' key
        
    Returns:
        Area of the bounding box
    """
    min_x, min_y, max_x, max_y = get_bbox_bounds(bbox)
    width = max_x - min_x
    height = max_y - min_y
    return width * height


def get_bbox_center(bbox: Dict[str, Any]) -> Tuple[float, float]:
    """Get center point of a bounding box.
    
    Args:
        bbox: Bounding box dict with 'vertices' key
        
    Returns:
        Tuple of (center_x, center_y)
    """
    min_x, min_y, max_x, max_y = get_bbox_bounds(bbox)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    return (center_x, center_y)


def calculate_distance(bbox1: Dict[str, Any], bbox2: Dict[str, Any]) -> float:
    """Calculate distance between centers of two bounding boxes.
    
    Args:
        bbox1: First bounding box
        bbox2: Second bounding box
        
    Returns:
        Euclidean distance between box centers
    """
    center1 = get_bbox_center(bbox1)
    center2 = get_bbox_center(bbox2)
    
    dx = center2[0] - center1[0]
    dy = center2[1] - center1[1]
    return sqrt(dx * dx + dy * dy)


def boxes_overlap_or_close(
    bbox1: Dict[str, Any],
    bbox2: Dict[str, Any],
    distance_threshold: float = 50.0
) -> bool:
    """Check if two bounding boxes overlap or are close to each other.
    
    Args:
        bbox1: First bounding box
        bbox2: Second bounding box
        distance_threshold: Maximum distance between boxes to consider them close (in pixels)
        
    Returns:
        True if boxes overlap or are close, False otherwise
    """
    min_x1, min_y1, max_x1, max_y1 = get_bbox_bounds(bbox1)
    min_x2, min_y2, max_x2, max_y2 = get_bbox_bounds(bbox2)
    
    # Check for overlap
    if not (max_x1 < min_x2 or max_x2 < min_x1 or max_y1 < min_y2 or max_y2 < min_y1):
        return True
    
    # Check if boxes are close (within threshold)
    distance = calculate_distance(bbox1, bbox2)
    return distance <= distance_threshold


def combine_bboxes(annotations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Combine multiple bounding boxes from annotations into a single larger bounding box.
    
    Args:
        annotations: List of annotation dicts, each with a 'bounding_box' key
        
    Returns:
        Combined bounding box dict with 'vertices' key
    """
    if not annotations:
        return {'vertices': []}
    
    if len(annotations) == 1:
        return annotations[0].get('bounding_box', {'vertices': []})
    
    # Get all bounds from annotation bounding boxes
    all_min_x = []
    all_min_y = []
    all_max_x = []
    all_max_y = []
    
    for ann in annotations:
        bbox = ann.get('bounding_box', {})
        if not bbox or 'vertices' not in bbox:
            continue
        min_x, min_y, max_x, max_y = get_bbox_bounds(bbox)
        all_min_x.append(min_x)
        all_min_y.append(min_y)
        all_max_x.append(max_x)
        all_max_y.append(max_y)
    
    if not all_min_x:
        return {'vertices': []}
    
    # Create combined bounding box
    combined_min_x = min(all_min_x)
    combined_min_y = min(all_min_y)
    combined_max_x = max(all_max_x)
    combined_max_y = max(all_max_y)
    
    # Return as rectangle (4 vertices)
    return {
        'vertices': [
            {'x': combined_min_x, 'y': combined_min_y},
            {'x': combined_max_x, 'y': combined_min_y},
            {'x': combined_max_x, 'y': combined_max_y},
            {'x': combined_min_x, 'y': combined_max_y}
        ]
    }


def combine_text_annotations(text_annotations: List[Dict[str, Any]]) -> str:
    """Combine text from multiple text annotations.
    
    Args:
        text_annotations: List of text annotation dicts with 'text' key
        
    Returns:
        Combined text string
    """
    texts = []
    for ann in text_annotations:
        text = ann.get('text', '').strip()
        if text:
            texts.append(text)
    
    # Join with space, but preserve line breaks if they exist
    combined = ' '.join(texts)
    return combined


def combine_bounding_boxes(
    extracted_data: Dict[str, Any],
    min_area_threshold: float = 500.0,
    max_area_threshold: float = 100000.0,
    distance_threshold: float = 1000.0
) -> Dict[str, Any]:
    """Combine small bounding boxes into larger ones.
    
    This function processes each page's text annotations and combines sequential
    small boxes into larger boxes. Boxes smaller than max_area_threshold are
    considered candidates for combination. Only consecutive (sequential) small
    boxes in the original list order are combined together. Large boxes
    (above max_area_threshold) are kept as-is and break sequences.
    
    IMPORTANT: This function processes each page independently in a separate loop
    iteration. Each page's text_annotations are extracted only from that page's
    page_data, ensuring that boxes from different pages can NEVER be combined.
    Additional validation checks are in place as safeguards.
    
    Args:
        extracted_data: Dictionary with 'pages' key containing page data
        min_area_threshold: Not currently used in filtering, reserved for future use (default: 500)
        max_area_threshold: Maximum area for a box to be considered for combination (default: 100000)
        distance_threshold: Not used in sequential mode, kept for API compatibility
        
    Returns:
        Modified extracted_data with combined bounding boxes
    """
    logger.info("Starting bounding box combination (sequential mode)")
    
    if 'pages' not in extracted_data:
        logger.warning("No pages found in extracted_data")
        return extracted_data
    
    pages = extracted_data['pages']
    total_original = 0
    total_combined = 0
    
    # Process each page independently - this loop structure ensures boxes from
    # different pages are NEVER combined, as each iteration processes only one page
    for page_idx, page_data in enumerate(pages):
        # Get page number for validation (0-indexed page_idx + 1)
        expected_page_number = page_data.get('page_number', page_idx + 1)
        text_annotations = page_data.get('text_annotations', [])
        if not text_annotations:
            continue
        
        total_original += len(text_annotations)
        logger.debug(f"Page {page_idx + 1} (page_number: {expected_page_number}): Processing {len(text_annotations)} bounding boxes")
        
        # Process annotations sequentially, combining consecutive small boxes
        # IMPORTANT: Each page is processed independently - boxes from different pages cannot be combined
        combined_annotations = []
        current_sequence = []
        
        for ann in text_annotations:
            # Validate that annotation belongs to current page (if page info is available)
            # This is a safeguard to ensure no cross-page combination occurs
            ann_page_number = ann.get('page_number')
            if ann_page_number is not None and ann_page_number != expected_page_number:
                logger.warning(
                    f"Page {page_idx + 1}: Annotation with page_number {ann_page_number} found in page {expected_page_number}. "
                    f"Skipping to prevent cross-page combination."
                )
                continue
            bbox = ann.get('bounding_box', {})
            area = get_bbox_area(bbox)
            
            # Check if this box is small enough to be combined
            if area <= max_area_threshold:
                # Add to current sequence
                current_sequence.append(ann)
            else:
                # Large box - first combine any pending sequence, then add this box
                if current_sequence:
                    # Combine the sequence (all boxes in sequence are from the same page)
                    if len(current_sequence) > 1:
                        # Verify all boxes in sequence are from the same page
                        sequence_page_numbers = [box.get('page_number') for box in current_sequence if box.get('page_number') is not None]
                        if sequence_page_numbers and len(set(sequence_page_numbers)) > 1:
                            logger.error(
                                f"Page {page_idx + 1}: Attempted to combine boxes from different pages: {set(sequence_page_numbers)}. "
                                f"This should never happen. Keeping boxes separate."
                            )
                            # Don't combine - keep boxes separate
                            combined_annotations.extend(current_sequence)
                        else:
                            # Combine bounding boxes
                            combined_bbox = combine_bboxes(current_sequence)
                            
                            # Combine text
                            combined_text = combine_text_annotations(current_sequence)
                            
                            # Create combined annotation
                            first_box = current_sequence[0]
                            combined_ann = {
                                'id': first_box.get('id', ''),
                                'text': combined_text,
                                'bounding_box': combined_bbox,
                                'type': first_box.get('type', 'block'),
                                'classification': first_box.get('classification', ''),
                                'confidence': first_box.get('confidence', ''),
                                'explanation': first_box.get('explanation', '')
                            }
                            
                            # Preserve page_number if it exists
                            if expected_page_number is not None:
                                combined_ann['page_number'] = expected_page_number
                            
                            combined_annotations.append(combined_ann)
                            logger.debug(f"Page {page_idx + 1}: Combined {len(current_sequence)} sequential boxes into 1")
                    else:
                        # Single box in sequence, keep as is
                        combined_annotations.append(current_sequence[0])
                    
                    current_sequence = []
                
                # Add the large box as-is
                combined_annotations.append(ann)
        
        # Handle any remaining sequence at the end of the page
        # IMPORTANT: This sequence only contains boxes from the current page
        if current_sequence:
            if len(current_sequence) > 1:
                # Verify all boxes in sequence are from the same page
                sequence_page_numbers = [box.get('page_number') for box in current_sequence if box.get('page_number') is not None]
                if sequence_page_numbers and len(set(sequence_page_numbers)) > 1:
                    logger.error(
                        f"Page {page_idx + 1}: Attempted to combine boxes from different pages at end: {set(sequence_page_numbers)}. "
                        f"This should never happen. Keeping boxes separate."
                    )
                    # Don't combine - keep boxes separate
                    combined_annotations.extend(current_sequence)
                else:
                    # Combine bounding boxes
                    combined_bbox = combine_bboxes(current_sequence)
                    
                    # Combine text
                    combined_text = combine_text_annotations(current_sequence)
                    
                    # Create combined annotation
                    first_box = current_sequence[0]
                    combined_ann = {
                        'id': first_box.get('id', ''),
                        'text': combined_text,
                        'bounding_box': combined_bbox,
                        'type': first_box.get('type', 'block'),
                        'classification': first_box.get('classification', ''),
                        'confidence': first_box.get('confidence', ''),
                        'explanation': first_box.get('explanation', '')
                    }
                    
                    # Preserve page_number if it exists
                    if expected_page_number is not None:
                        combined_ann['page_number'] = expected_page_number
                    
                    combined_annotations.append(combined_ann)
                    logger.debug(f"Page {page_idx + 1}: Combined {len(current_sequence)} sequential boxes into 1 (end of list)")
            else:
                # Single box in sequence, keep as is
                combined_annotations.append(current_sequence[0])
        
        # Update page data with combined annotations
        # All annotations in combined_annotations are from the current page only
        page_data['text_annotations'] = combined_annotations
        total_combined += len(combined_annotations)
        
        # Final validation: verify all combined annotations belong to this page
        final_page_numbers = [ann.get('page_number') for ann in combined_annotations if ann.get('page_number') is not None]
        if final_page_numbers and any(pn != expected_page_number for pn in final_page_numbers):
            logger.error(
                f"Page {page_idx + 1}: Validation failed - found annotations from other pages in final result: "
                f"{[pn for pn in final_page_numbers if pn != expected_page_number]}"
            )
        
        logger.debug(f"Page {page_idx + 1}: Reduced from {len(text_annotations)} to {len(combined_annotations)} boxes")
    
    logger.info(f"Bounding box combination complete: {total_original} -> {total_combined} boxes")
    
    return extracted_data

