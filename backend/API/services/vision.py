"""Vision API service for image classification."""
import os
import logging
from typing import Optional, List, Dict, Any
from google.cloud import vision
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def get_vision_client() -> Optional[vision.ImageAnnotatorClient]:
    """Initialize and return Vision API client if credentials are available."""
    try:
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path or not os.path.exists(credentials_path):
            logger.warning("Google Vision API credentials not found, skipping image classification")
            return None
        
        client = vision.ImageAnnotatorClient()
        logger.debug("Vision API client initialized successfully")
        return client
    except Exception as e:
        logger.warning(f"Failed to initialize Vision API client: {str(e)}. Skipping image classification.")
        return None


def get_likelihood_name(likelihood_enum) -> str:
    """Convert Likelihood enum to string name."""
    likelihood_map = {
        0: "UNKNOWN",
        1: "VERY_UNLIKELY",
        2: "UNLIKELY",
        3: "POSSIBLE",
        4: "LIKELY",
        5: "VERY_LIKELY"
    }
    
    if hasattr(likelihood_enum, 'name'):
        return likelihood_enum.name
    elif isinstance(likelihood_enum, int):
        return likelihood_map.get(likelihood_enum, "UNKNOWN")
    else:
        return str(likelihood_enum)


def parse_safe_search_result(safe_search_annotation, error: Optional[str] = None) -> Dict[str, Any]:
    """Parse Safe Search annotation into a dictionary."""
    if error:
        return {
            "error": error,
            "adult": None,
            "spoof": None,
            "medical": None,
            "violence": None,
            "racy": None,
        }
    
    if not safe_search_annotation:
        return {
            "error": "No safe search annotation in response",
            "adult": None,
            "spoof": None,
            "medical": None,
            "violence": None,
            "racy": None,
        }
    
    return {
        "adult": get_likelihood_name(safe_search_annotation.adult),
        "spoof": get_likelihood_name(safe_search_annotation.spoof),
        "medical": get_likelihood_name(safe_search_annotation.medical),
        "violence": get_likelihood_name(safe_search_annotation.violence),
        "racy": get_likelihood_name(safe_search_annotation.racy),
    }


def batch_classify_images_safe_search(
    image_contents: List[bytes],
    vision_client: vision.ImageAnnotatorClient,
    batch_size: int = 16
) -> List[Dict[str, Any]]:
    """
    Classify multiple images using Google Vision API Safe Search in batches.
    
    Args:
        image_contents: List of image file contents as bytes
        vision_client: Initialized Vision API client
        batch_size: Number of images per batch (max 16, default 16)
        
    Returns:
        List of dictionaries with Safe Search classification results for each image
    """
    if batch_size > 16:
        batch_size = 16  # Google Vision API limit
        logger.warning(f"Batch size capped at 16 (API limit)")
    
    results = []
    total_images = len(image_contents)
    
    # Process images in batches
    for batch_start in range(0, total_images, batch_size):
        batch_end = min(batch_start + batch_size, total_images)
        batch_contents = image_contents[batch_start:batch_end]
        batch_num = (batch_start // batch_size) + 1
        total_batches = (total_images + batch_size - 1) // batch_size
        
        logger.debug(f"Processing batch {batch_num}/{total_batches} ({len(batch_contents)} images)...")
        
        try:
            # Prepare batch request
            requests = []
            batch_results = [None] * len(batch_contents)
            
            for idx, image_content in enumerate(batch_contents):
                try:
                    image = vision.Image(content=image_content)
                    request = vision.AnnotateImageRequest(
                        image=image,
                        features=[vision.Feature(type_=vision.Feature.Type.SAFE_SEARCH_DETECTION)]
                    )
                    requests.append((idx, request))
                except Exception as e:
                    batch_results[idx] = parse_safe_search_result(None, f"Failed to process image: {str(e)}")
            
            # Only process batch if we have valid requests
            if requests:
                api_requests = [req for _, req in requests]
                request_mapping = {i: orig_idx for i, (orig_idx, _) in enumerate(requests)}
                
                # Make batch API call
                batch_response = vision_client.batch_annotate_images(requests=api_requests)
                
                # Map responses back to original indices
                for api_idx, response in enumerate(batch_response.responses):
                    if api_idx in request_mapping:
                        orig_idx = request_mapping[api_idx]
                        
                        if response.error and response.error.message:
                            batch_results[orig_idx] = parse_safe_search_result(None, response.error.message)
                        else:
                            safe_search = response.safe_search_annotation
                            batch_results[orig_idx] = parse_safe_search_result(safe_search)
            
            # Fill in any None results
            for idx, result in enumerate(batch_results):
                if result is None:
                    batch_results[idx] = parse_safe_search_result(None, "No result returned from API")
            
            results.extend(batch_results)
            
        except Exception as e:
            logger.error(f"Batch {batch_num} failed: {e}", exc_info=True)
            error_result = parse_safe_search_result(None, f"Batch processing error: {str(e)}")
            for _ in batch_contents:
                results.append(error_result)
    
    return results

