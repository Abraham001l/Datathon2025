import os
import json
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from google.cloud import documentai
import sys
from pdfparse import extract_text_with_boxes

# Add parent directory to path to import from routes
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

# Import upload functions from upload.py
from routes.upload import upload_file_to_gridfs, upload_bounding_boxes

load_dotenv()

router = APIRouter(prefix="/parse", tags=["parse"])


def get_document_ai_client():
    """Initialize and return Document AI client."""
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path or not os.path.exists(credentials_path):
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_APPLICATION_CREDENTIALS not configured properly"
        )
    
    try:
        return documentai.DocumentProcessorServiceClient()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Document AI client: {str(e)}"
        )


@router.post("/parse-pdf")
async def upload_and_process_pdf(
    file: UploadFile = File(...),
    processor_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    status: Optional[str] = Form("pending_classification"),
    ai_classified_sensitivity: Optional[str] = Form("unclassified")
):
    """Upload a PDF, process it with Document AI, and store both the PDF and bounding boxes in MongoDB."""
    
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    processor_name = processor_name or os.getenv("DOCUMENT_AI_PROCESSOR_NAME")
    if not processor_name:
        raise HTTPException(
            status_code=400,
            detail="Processor name not provided. Set DOCUMENT_AI_PROCESSOR_NAME in .env or provide processor_name parameter"
        )
    
    # Create temporary directory for processing
    temp_dir = tempfile.mkdtemp()
    try:
        # Save uploaded file temporarily
        pdf_path = Path(temp_dir) / file.filename
        with open(pdf_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Read PDF content for processing and storage
        with open(pdf_path, "rb") as pdf_file:
            pdf_content = pdf_file.read()
        
        # Process with Document AI
        client = get_document_ai_client()
        
        raw_document = documentai.RawDocument(
            content=pdf_content,
            mime_type="application/pdf"
        )
        
        request = documentai.ProcessRequest(
            name=processor_name,
            raw_document=raw_document
        )
        
        result = client.process_document(request=request)
        document = result.document
        
        # Extract text and bounding boxes
        extracted_data = extract_text_with_boxes(document)
        
        # Clean up temporary data
        if '_image_elements' in extracted_data:
            del extracted_data['_image_elements']
        
        # Upload PDF to GridFS using upload_file_to_gridfs
        pdf_file_id, is_update = await upload_file_to_gridfs(
            file_contents=pdf_content,
            filename=file.filename,
            content_type=file.content_type or "application/pdf",
            description=description,
            category=category,
            status=status,
            ai_classified_sensitivity=ai_classified_sensitivity
        )
        
        # Upload bounding boxes using upload_bounding_boxes
        bounding_boxes_id = upload_bounding_boxes(
            pdf_file_id=pdf_file_id,
            filename=file.filename,
            extracted_data=extracted_data
        )
        
        # Get summary from extracted_data
        summary = {
            'total_pages': len(extracted_data['pages']),
            'total_text_annotations': sum(len(p['text_annotations']) for p in extracted_data['pages']),
            'total_images': len(extracted_data['images']),
            'full_text_length': len(extracted_data['full_text'])
        }
        
        return JSONResponse(
            status_code=201,
            content={
                "message": "PDF processed and uploaded successfully",
                "pdf_file_id": pdf_file_id,
                "bounding_boxes_id": bounding_boxes_id,
                "filename": file.filename,
                "summary": summary
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
    finally:
        # Clean up temporary directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)




@router.get("/list-processors")
async def list_processors(location: str = "us"):
    """List all Document AI processors."""
    try:
        client = get_document_ai_client()
        
        # Try to get project ID from credentials
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        project_id = None
        if credentials_path and os.path.exists(credentials_path):
            with open(credentials_path, 'r') as f:
                creds = json.load(f)
                project_id = creds.get('project_id')
        
        if not project_id:
            raise HTTPException(
                status_code=400,
                detail="Could not determine project ID. Please provide it."
            )
        
        parent = f"projects/{project_id}/locations/{location}"
        processors = client.list_processors(parent=parent)
        
        processor_list = []
        for processor in processors:
            processor_list.append({
                'name': processor.name,
                'display_name': processor.display_name,
                'type': processor.type_,
                'state': processor.state.name,
                'create_time': str(processor.create_time)
            })
        
        return {
            'location': location,
            'processors': processor_list
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

