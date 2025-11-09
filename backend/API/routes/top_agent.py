"""Tree of Prompts (ToP) Agent route handler."""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import sys
from pathlib import Path

# Add parent directory to path to import services
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from services.top_agent import get_top_agent, ToP_Agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/top-agent", tags=["top-agent"])


class ClassifyTextRequest(BaseModel):
    """Request model for single text classification."""
    text: str
    

class ClassifyBlocksRequest(BaseModel):
    """Request model for multiple block classification."""
    blocks: List[str]
    summary: Optional[str] = ""


class ChainEditRequest(BaseModel):
    """Request model for AI chain editing."""
    tree_index: int
    suggestion: str


class HumanChainEditRequest(BaseModel):
    """Request model for manual chain editing."""
    tree_index: int
    chain_index: int
    new_text: str


class HumanChainAddRequest(BaseModel):
    """Request model for manual chain addition."""
    tree_index: int
    new_text: str


class HumanChainRemoveRequest(BaseModel):
    """Request model for manual chain removal."""
    tree_index: int
    chain_index: int


@router.post("/classify")
async def classify_text(request: ClassifyTextRequest):
    """Classify a single text block into sensitivity categories.
    
    Args:
        request: Request containing text to classify
        
    Returns:
        Classification results with prompts and responses
    """
    try:
        logger.info(f"Classification request received for text of length: {len(request.text)}")
        agent = get_top_agent()
        result = agent.run(request.text)
        logger.info("Classification completed successfully")
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error classifying text: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error classifying text: {str(e)}")


@router.post("/classify-blocks")
async def classify_blocks(request: ClassifyBlocksRequest):
    """Classify multiple text blocks in parallel.
    
    Args:
        request: Request containing list of text blocks and optional summary
        
    Returns:
        List of classification results for each block
    """
    try:
        logger.info(f"Block classification request received for {len(request.blocks)} blocks")
        agent = get_top_agent()
        results = agent.run_doc(request.blocks, request.summary or "")
        logger.info(f"Block classification completed for {len(results)} blocks")
        return JSONResponse(content={"results": results, "count": len(results)})
    except Exception as e:
        logger.error(f"Error classifying blocks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error classifying blocks: {str(e)}")


@router.post("/chain/ai-edit")
async def ai_chain_edit(request: ChainEditRequest):
    """Edit a classification chain using AI to generate a new prompt.
    
    Args:
        request: Request containing tree index and suggestion
        
    Returns:
        Updated chain
    """
    try:
        if not (0 <= request.tree_index <= 3):
            raise HTTPException(status_code=400, detail="tree_index must be between 0 and 3")
        
        logger.info(f"AI chain edit request for tree_index: {request.tree_index}")
        agent = get_top_agent()
        updated_chain = agent.ai_chain_edit(request.tree_index, request.suggestion)
        logger.info("AI chain edit completed successfully")
        return JSONResponse(content={"chain": updated_chain})
    except Exception as e:
        logger.error(f"Error editing chain: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error editing chain: {str(e)}")


@router.post("/chain/human-edit")
async def human_chain_edit(request: HumanChainEditRequest):
    """Manually edit a specific prompt in a classification chain.
    
    Args:
        request: Request containing tree index, chain index, and new text
        
    Returns:
        Success message
    """
    try:
        if not (0 <= request.tree_index <= 3):
            raise HTTPException(status_code=400, detail="tree_index must be between 0 and 3")
        
        logger.info(f"Human chain edit request for tree_index: {request.tree_index}, chain_index: {request.chain_index}")
        agent = get_top_agent()
        agent.human_chain_edit(request.tree_index, request.chain_index, request.new_text)
        logger.info("Human chain edit completed successfully")
        return JSONResponse(content={"message": "Chain edited successfully"})
    except IndexError as e:
        logger.error(f"Invalid chain_index: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid chain_index: {str(e)}")
    except Exception as e:
        logger.error(f"Error editing chain: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error editing chain: {str(e)}")


@router.post("/chain/human-add")
async def human_chain_add(request: HumanChainAddRequest):
    """Manually add a new prompt to a classification chain.
    
    Args:
        request: Request containing tree index and new text
        
    Returns:
        Success message
    """
    try:
        if not (0 <= request.tree_index <= 3):
            raise HTTPException(status_code=400, detail="tree_index must be between 0 and 3")
        
        logger.info(f"Human chain add request for tree_index: {request.tree_index}")
        agent = get_top_agent()
        agent.human_chain_add(request.tree_index, request.new_text)
        logger.info("Human chain add completed successfully")
        return JSONResponse(content={"message": "Prompt added to chain successfully"})
    except Exception as e:
        logger.error(f"Error adding to chain: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error adding to chain: {str(e)}")


@router.post("/chain/human-remove")
async def human_chain_remove(request: HumanChainRemoveRequest):
    """Manually remove a prompt from a classification chain.
    
    Args:
        request: Request containing tree index and chain index
        
    Returns:
        Success message
    """
    try:
        if not (0 <= request.tree_index <= 3):
            raise HTTPException(status_code=400, detail="tree_index must be between 0 and 3")
        
        logger.info(f"Human chain remove request for tree_index: {request.tree_index}, chain_index: {request.chain_index}")
        agent = get_top_agent()
        agent.human_chain_remove(request.tree_index, request.chain_index)
        logger.info("Human chain remove completed successfully")
        return JSONResponse(content={"message": "Prompt removed from chain successfully"})
    except IndexError as e:
        logger.error(f"Invalid chain_index: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid chain_index: {str(e)}")
    except Exception as e:
        logger.error(f"Error removing from chain: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error removing from chain: {str(e)}")


@router.get("/chains")
async def get_chains():
    """Get all classification chains.
    
    Returns:
        Dictionary containing all classification chains
    """
    try:
        logger.info("Get chains request received")
        agent = get_top_agent()
        chains = {
            "sensitive": agent.sensitive_chain,
            "confidential": agent.confidential_chain,
            "public": agent.public_chain,
            "unsafe": agent.unsafe_chain
        }
        return JSONResponse(content=chains)
    except Exception as e:
        logger.error(f"Error getting chains: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting chains: {str(e)}")

