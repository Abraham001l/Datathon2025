"""Small tester for PyMuPDF (fitz) library."""
import fitz  # PyMuPDF
import os
import sys
import json
from dotenv import load_dotenv
from google.cloud import vision

# Load environment variables from .env file
load_dotenv()


def get_likelihood_name(likelihood_enum):
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


def parse_safe_search_result(safe_search_annotation, error=None):
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


def batch_classify_images_safe_search(image_paths: list, vision_client: vision.ImageAnnotatorClient, batch_size: int = 16) -> list:
    """
    Classify multiple images using Google Vision API Safe Search in batches.
    
    Google Vision API allows up to 16 images per batch request, which is more
    cost-efficient than individual API calls.
    
    Args:
        image_paths: List of image file paths to classify
        vision_client: Initialized Vision API client
        batch_size: Number of images per batch (max 16, default 16)
        
    Returns:
        List of dictionaries with Safe Search classification results for each image
    """
    if batch_size > 16:
        batch_size = 16  # Google Vision API limit
        print(f"  Warning: Batch size capped at 16 (API limit)")
    
    results = []
    total_images = len(image_paths)
    
    # Process images in batches
    for batch_start in range(0, total_images, batch_size):
        batch_end = min(batch_start + batch_size, total_images)
        batch_paths = image_paths[batch_start:batch_end]
        batch_num = (batch_start // batch_size) + 1
        total_batches = (total_images + batch_size - 1) // batch_size
        
        print(f"  Processing batch {batch_num}/{total_batches} ({len(batch_paths)} images)...")
        
        try:
            # Prepare batch request - track which images succeed/fail
            requests = []
            batch_results = [None] * len(batch_paths)  # Pre-allocate results list
            
            for idx, image_path in enumerate(batch_paths):
                try:
                    with open(image_path, "rb") as image_file:
                        content = image_file.read()
                    image = vision.Image(content=content)
                    # Create request for Safe Search detection
                    request = vision.AnnotateImageRequest(
                        image=image,
                        features=[vision.Feature(type_=vision.Feature.Type.SAFE_SEARCH_DETECTION)]
                    )
                    requests.append((idx, request))  # Store original index with request
                except Exception as e:
                    # If we can't read an image, store error result immediately
                    batch_results[idx] = parse_safe_search_result(None, f"Failed to read image: {str(e)}")
            
            # Only process batch if we have valid requests
            if requests:
                # Extract just the requests for the API call
                api_requests = [req for _, req in requests]
                request_mapping = {i: orig_idx for i, (orig_idx, _) in enumerate(requests)}
                
                # Make batch API call
                batch_response = vision_client.batch_annotate_images(requests=api_requests)
                
                # Verify we got the expected number of responses
                if len(batch_response.responses) != len(api_requests):
                    print(f"    ⚠ Warning: Expected {len(api_requests)} responses, got {len(batch_response.responses)}")
                
                # Map responses back to original image indices
                for api_idx, response in enumerate(batch_response.responses):
                    if api_idx in request_mapping:
                        orig_idx = request_mapping[api_idx]
                        
                        # Check for errors
                        if response.error.message:
                            batch_results[orig_idx] = parse_safe_search_result(None, response.error.message)
                        else:
                            # Extract Safe Search results
                            safe_search = response.safe_search_annotation
                            batch_results[orig_idx] = parse_safe_search_result(safe_search)
                    else:
                        print(f"    ⚠ Warning: Response index {api_idx} not in request mapping")
            
            # Fill in any None results (shouldn't happen, but safety check)
            for idx, result in enumerate(batch_results):
                if result is None:
                    batch_results[idx] = parse_safe_search_result(None, "No result returned from API")
            
            # Add all batch results to main results list (maintaining order)
            results.extend(batch_results)
            
        except Exception as e:
            # If batch fails, add error results for all images in batch
            print(f"    ✗ Batch {batch_num} failed: {e}")
            error_result = parse_safe_search_result(None, f"Batch processing error: {str(e)}")
            for _ in batch_paths:
                results.append(error_result)
    
    return results


def init_vision_client(credentials_path: str = None) -> vision.ImageAnnotatorClient:
    """
    Initialize Google Vision API client.
    
    Args:
        credentials_path: Path to service account JSON key file.
                         If None, checks GOOGLE_APPLICATION_CREDENTIALS env var
                         (which can be set in .env file).
    
    Returns:
        Initialized Vision API client
        
    Raises:
        ValueError: If credentials are not found or invalid
        FileNotFoundError: If credentials_path is provided but file doesn't exist
    """
    # Priority: 1) credentials_path parameter, 2) .env file, 3) environment variable
    if credentials_path:
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(f"Credentials file not found: {credentials_path}")
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    else:
        # Check if already set in environment (from .env or system env)
        credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if credentials_path and not os.path.exists(credentials_path):
            # Path from env var doesn't exist, try relative to project root
            project_root = os.path.dirname(os.path.abspath(__file__))
            abs_path = os.path.join(project_root, credentials_path)
            if os.path.exists(abs_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_path
            else:
                raise FileNotFoundError(
                    f"Credentials file not found: {credentials_path} "
                    f"(also tried: {abs_path})"
                )
    
    # Check if credentials are set
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        raise ValueError(
            "Google Vision API credentials not found. "
            "Set GOOGLE_APPLICATION_CREDENTIALS in .env file, "
            "environment variable, or pass credentials_path parameter."
        )
    
    try:
        return vision.ImageAnnotatorClient()
    except Exception as e:
        raise ValueError(f"Failed to initialize Vision API client: {e}")


def test_basic_operations(pdf_path: str = None, output_dir: str = "outputs", vision_client: vision.ImageAnnotatorClient = None):
    """Test basic PyMuPDF operations."""
    print("=" * 50)
    print("PyMuPDF Tester")
    print("=" * 50)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    print(f"\nOutput directory: {output_dir}")
    
    if not pdf_path:
        pdf_path = "TC5_Testing_Multiple_Non_Compliance_Categorization.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"\n✗ Error: PDF file not found: {pdf_path}")
        return
    
    try:
        # Open PDF
        print(f"\nOpening PDF: {pdf_path}")
        doc = fitz.open(pdf_path)
        
        # Get page count
        page_count = len(doc)
        print(f"Page count: {page_count}")
        
        # Process every page - extract only embedded images (not page renders)
        print(f"\n--- Extracting embedded images from {page_count} page(s) ---")
        total_images = 0
        all_image_metadata = []
        page_bboxes = {}  # Store bboxes per page for visualization
        
        for page_num in range(page_count):
            page = doc[page_num]
            
            # Get images on page (only embedded images, not rendered page content)
            images = page.get_images(full=True)
            if images:
                print(f"\nPage {page_num + 1}: {len(images)} image(s) found")
            
            # Build a mapping of xref to bounding boxes from page content blocks
            xref_to_bbox = {}
            try:
                # Get image blocks from page content dictionary
                page_dict = page.get_text("dict")
                for block in page_dict.get("blocks", []):
                    if block.get("type") == 1 and "image" in block:  # Type 1 = image block
                        img_data = block["image"]
                        # The image block contains bbox and may reference xref
                        bbox_rect = fitz.Rect(block["bbox"])
                        # Try to match with xref if available in image data
                        if "xref" in img_data:
                            xref_to_bbox[img_data["xref"]] = bbox_rect
                        elif "ext" in img_data:
                            # Sometimes we can match by image properties
                            # For now, we'll collect all bboxes and match by index
                            pass
            except Exception:
                pass
            
            # Also try to get rectangles using get_image_rects for each xref
            for img_info in images:
                xref = img_info[0]
                if xref not in xref_to_bbox:
                    try:
                        rects = page.get_image_rects(xref)
                        if rects and len(rects) > 0:
                            xref_to_bbox[xref] = rects[0]
                    except Exception:
                        pass
            
            # Store bboxes for this page for visualization
            page_bboxes[page_num] = []
            
            # Extract images
            for img_idx, img in enumerate(images):
                xref = img[0]  # xref is the first element
                try:
                    # Extract the actual embedded image data (not a page render)
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]  # Get the actual image extension (png, jpg, etc.)
                    image_filename = os.path.join(output_dir, f"page_{page_num + 1:04d}_img_{img_idx + 1}_xref_{xref}.{image_ext}")
                    
                    # Save the extracted image
                    with open(image_filename, "wb") as f:
                        f.write(image_bytes)
                    
                    # Get bounding box if available
                    bbox_dict = None
                    bbox_rect = None
                    if xref in xref_to_bbox:
                        bbox = xref_to_bbox[xref]
                        bbox_rect = bbox
                        bbox_dict = {
                            "x0": round(bbox.x0, 2),
                            "y0": round(bbox.y0, 2),
                            "x1": round(bbox.x1, 2),
                            "y1": round(bbox.y1, 2),
                            "width": round(bbox.width, 2),
                            "height": round(bbox.height, 2)
                        }
                        # Store for visualization
                        page_bboxes[page_num].append(bbox_rect)
                    
                    # Store metadata
                    rect = page.rect
                    image_metadata = {
                        "page": page_num + 1,
                        "image_index": img_idx + 1,
                        "xref": xref,
                        "filename": os.path.basename(image_filename),
                        "extension": image_ext,
                        "size_bytes": len(image_bytes),
                        "bounding_box": bbox_dict,
                        "page_width": round(rect.width, 2),
                        "page_height": round(rect.height, 2)
                    }
                    all_image_metadata.append(image_metadata)
                    
                    print(f"  ✓ Image {img_idx + 1}: {os.path.basename(image_filename)} ({len(image_bytes)} bytes, {image_ext})")
                    if bbox_dict:
                        print(f"    Bounding box: ({bbox_dict['x0']}, {bbox_dict['y0']}) to ({bbox_dict['x1']}, {bbox_dict['y1']})")
                    else:
                        print(f"    Bounding box: Not available")
                    total_images += 1
                except Exception as img_error:
                    print(f"  ✗ Failed to extract image {img_idx + 1} (xref={xref}): {img_error}")
        
        # Create visualizations with bounding boxes
        print(f"\n--- Creating visualizations with bounding boxes ---")
        for page_num, bboxes in page_bboxes.items():
            if bboxes:
                page = doc[page_num]
                try:
                    # Method 1: Try using annotations (most reliable for transparency)
                    for bbox in bboxes:
                        # Add rectangle annotation with transparent red fill
                        annot = page.add_rect_annot(bbox)
                        annot.set_colors(stroke=(1, 0, 0), fill=(1, 0, 0))  # Red stroke and fill
                        annot.set_opacity(0.3)  # 30% opacity (70% transparent)
                        annot.update()
                    
                    # Render the page with bounding boxes at 2x zoom for better quality
                    mat = fitz.Matrix(2.0, 2.0)
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    
                    # Save the visualized page
                    viz_filename = os.path.join(output_dir, f"page_{page_num + 1:04d}_with_bboxes.png")
                    pix.save(viz_filename)
                    print(f"  ✓ Saved visualization: {os.path.basename(viz_filename)} ({len(bboxes)} bbox(es))")
                    
                    # Clean up annotations after rendering (optional, but good practice)
                    for annot in page.annots():
                        annot.delete()
                        
                except Exception as viz_error:
                    # Fallback: Try using shape drawing
                    try:
                        shape = page.new_shape()
                        red_color = (1, 0, 0)  # Red color
                        
                        for bbox in bboxes:
                            shape.draw_rect(bbox)
                            # Try different finish parameter formats
                            try:
                                shape.finish(fill=red_color, color=red_color, width=2, fill_opacity=0.3)
                            except:
                                # Alternative format
                                shape.finish(fill=(1, 0, 0), color=(1, 0, 0), width=2)
                        
                        shape.commit()
                        
                        # Render
                        mat = fitz.Matrix(2.0, 2.0)
                        pix = page.get_pixmap(matrix=mat, alpha=False)
                        viz_filename = os.path.join(output_dir, f"page_{page_num + 1:04d}_with_bboxes.png")
                        pix.save(viz_filename)
                        print(f"  ✓ Saved visualization: {os.path.basename(viz_filename)} ({len(bboxes)} bbox(es))")
                    except Exception as alt_error:
                        print(f"  ✗ Failed to create visualization for page {page_num + 1}: {viz_error}")
                        print(f"    Alternative method also failed: {alt_error}")
        
        # Classify images using Google Vision API Safe Search (batched for cost efficiency)
        if vision_client:
            print(f"\n--- Classifying images with Google Vision API Safe Search (Batched) ---")
            print(f"  Total images to classify: {len(all_image_metadata)}")
            
            # Collect valid image paths and their corresponding metadata indices
            image_paths = []
            metadata_indices = []
            
            for idx, img_metadata in enumerate(all_image_metadata):
                image_path = os.path.join(output_dir, img_metadata["filename"])
                if os.path.exists(image_path):
                    image_paths.append(image_path)
                    metadata_indices.append(idx)
                else:
                    print(f"  ✗ Image not found: {img_metadata['filename']}")
                    img_metadata["safe_search"] = {"error": "Image file not found"}
            
            # Batch classify all images
            if image_paths:
                print(f"  Classifying {len(image_paths)} images in batches (max 16 per batch)...")
                safe_search_results = batch_classify_images_safe_search(image_paths, vision_client, batch_size=16)
                
                # Assign results back to metadata
                for result_idx, metadata_idx in enumerate(metadata_indices):
                    if result_idx < len(safe_search_results):
                        all_image_metadata[metadata_idx]["safe_search"] = safe_search_results[result_idx]
                        
                        # Print summary for each image
                        result = safe_search_results[result_idx]
                        if "error" in result and result["error"]:
                            print(f"    ✗ {all_image_metadata[metadata_idx]['filename']}: {result['error']}")
                        else:
                            print(f"    ✓ {all_image_metadata[metadata_idx]['filename']}: "
                                  f"Adult={result['adult']}, Violence={result['violence']}, "
                                  f"Racy={result['racy']}")
                
                print(f"  ✓ Completed batch classification of {len(image_paths)} images")
            else:
                print(f"  No valid images found to classify")
        else:
            print(f"\n--- Skipping Safe Search classification (no Vision API client) ---")
            print(f"  To enable Safe Search:")
            print(f"    1. Create a .env file (see .env.example)")
            print(f"    2. Set GOOGLE_APPLICATION_CREDENTIALS in .env file")
            print(f"    3. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable")
            print(f"    4. Or pass credentials_path as command line argument")
        
        # Save metadata to JSON file
        metadata_file = os.path.join(output_dir, "image_metadata.json")
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(all_image_metadata, f, indent=2)
        print(f"\n--- Summary ---")
        print(f"Total images extracted: {total_images}")
        print(f"Metadata saved to: {metadata_file}")
        
        doc.close()
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exception(*sys.exc_info())


if __name__ == "__main__":
    # Parse command line arguments
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else None
    credentials_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Initialize Vision API client if credentials are available
    vision_client = None
    try:
        vision_client = init_vision_client(credentials_path)
        print("✓ Google Vision API client initialized")
    except Exception as e:
        print(f"⚠ Google Vision API not available: {e}")
        print("  Continuing without Safe Search classification...")
        vision_client = None
    
    test_basic_operations(pdf_path, vision_client=vision_client)

