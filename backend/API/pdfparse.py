from typing import List, Dict, Any

from google.cloud import documentai

def extract_text_with_boxes(document: documentai.Document) -> Dict[str, Any]:
    """Extract text and bounding boxes from Document AI response.
    
    Args:
        document: Document AI document response
        
    Returns:
        Dictionary with text, bounding boxes, and page information
    """
    result = {
        'full_text': document.text,
        'pages': [],
        'images': []
    }
    
    # Counter for generating unique IDs for bounding boxes
    bbox_id_counter = 1
    
    for page_num, page in enumerate(document.pages):
        page_info = {
            'page_number': page_num + 1,
            'dimension': {
                'width': page.dimension.width,
                'height': page.dimension.height
            },
            'text_annotations': []
        }
        
        # Extract text segments with bounding boxes
        # Extract from blocks (higher-level text blocks)
        for block in page.blocks:
            if hasattr(block, 'layout') and block.layout:
                if hasattr(block.layout, 'text_anchor') and block.layout.text_anchor:
                    block_text = get_text(block.layout.text_anchor, document.text)
                    if hasattr(block.layout, 'bounding_poly') and block.layout.bounding_poly:
                        bbox = get_bounding_box(block.layout.bounding_poly)
                        page_info['text_annotations'].append({
                            'id': str(bbox_id_counter),
                            'text': block_text,
                            'bounding_box': bbox,
                            'type': 'block',
                            'classification': '',
                            'confidence': '',
                            'explanation': ''
                        })
                        bbox_id_counter += 1
        
        # Extract from tokens (more granular, word-level)
        # Skipping token-level bounding boxes - only processing blocks
        # for token in page.tokens:
        #     if hasattr(token, 'layout') and token.layout:
        #         if hasattr(token.layout, 'text_anchor') and token.layout.text_anchor:
        #             token_text = get_text(token.layout.text_anchor, document.text)
        #             if hasattr(token.layout, 'bounding_poly') and token.layout.bounding_poly:
        #                 bbox = get_bounding_box(token.layout.bounding_poly)
        #                 page_info['text_annotations'].append({
        #                     'text': token_text,
        #                     'bounding_box': bbox,
        #                     'type': 'token'
        #                 })
        
        result['pages'].append(page_info)
    
    # Extract images from document
    for page_num, page in enumerate(document.pages):
        if hasattr(page, 'detected_visual_elements'):
            for image in page.detected_visual_elements:
                if hasattr(image, 'layout') and image.layout:
                    if hasattr(image.layout, 'bounding_poly') and image.layout.bounding_poly:
                        bbox = get_bounding_box(image.layout.bounding_poly)
                        result['images'].append({
                            'page_number': page_num + 1,
                            'bounding_box': bbox
                        })
    
    return result


def get_text(text_anchor: documentai.Document.TextAnchor, text: str) -> str:
    """Extract text from text anchor.
    
    Args:
        text_anchor: Text anchor from Document AI
        text: Full document text
        
    Returns:
        Extracted text string
    """
    if not text_anchor.text_segments:
        return ""
    
    response_text = ""
    for segment in text_anchor.text_segments:
        start_index = int(segment.start_index) if segment.start_index else 0
        end_index = int(segment.end_index) if segment.end_index else len(text)
        response_text += text[start_index:end_index]
    
    return response_text


def get_bounding_box(bounding_poly: documentai.BoundingPoly) -> Dict[str, List[Dict[str, float]]]:
    """Convert bounding poly to dictionary format.
    
    Args:
        bounding_poly: Bounding polygon from Document AI
        
    Returns:
        Dictionary with vertices
    """
    vertices = []
    for vertex in bounding_poly.vertices:
        vertices.append({
            'x': vertex.x if vertex.x else 0.0,
            'y': vertex.y if vertex.y else 0.0
        })
    
    return {'vertices': vertices}
