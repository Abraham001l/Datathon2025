"""LLM service for document summarization."""
import os
import logging
from typing import Optional
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class VultrLLM:
    """Wrapper for Vultr LLM API."""
    
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.vultrinference.com/v1/chat/completions"

    def run(self, text: str) -> str:
        """Run the LLM with the provided text."""
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": text}
            ],
            "temperature": 0.7,
            "max_tokens": 512
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(self.url, headers=headers, json=data)
            response.raise_for_status()
            out = response.json()["choices"][0]["message"]["content"]
            return out
        except requests.exceptions.HTTPError as e:
            # Log the error response for debugging
            if hasattr(e.response, 'text'):
                logger.error(f"Vultr API error response: {e.response.text}")
            if hasattr(e.response, 'json'):
                try:
                    error_detail = e.response.json()
                    logger.error(f"Vultr API error details: {error_detail}")
                except:
                    pass
            raise

    def generate_summary(self, text: str) -> str:
        """Generate a summary of the provided text."""
        logger.info(f"Starting summary generation - Input text length: {len(text)} characters")
        
        if not text or not text.strip():
            logger.warning("Empty or whitespace-only text provided for summary generation")
            return "No text content available for summary."
        
        # Truncate text if too long (limit to avoid token limits)
        MAX_TEXT_LENGTH = 8000
        original_length = len(text)
        if len(text) > MAX_TEXT_LENGTH:
            text_to_summarize = text[:MAX_TEXT_LENGTH] + "\n\n[Document truncated for summarization]"
            logger.info(f"Text truncated from {original_length} to {MAX_TEXT_LENGTH} characters for summary generation")
        else:
            text_to_summarize = text
            logger.debug(f"Text length within limits ({len(text)} chars), no truncation needed")
        
        prompt = f"Please provide a concise summary of the following document. Focus on the main topics, key points, and important information.\n\nDocument text:\n{text_to_summarize}\n\nSummary:"
        
        logger.debug(f"Calling LLM API with model: {self.model} for summary generation")
        try:
            summary = self.run(prompt)
            logger.info(f"Summary generation completed - Generated summary length: {len(summary)} characters")
            # Log a preview of the summary (first 200 characters)
            summary_preview = summary[:200] + "..." if len(summary) > 200 else summary
            logger.debug(f"Summary preview: {summary_preview}")
            return summary
        except Exception as e:
            logger.error(f"Error during summary generation: {str(e)}", exc_info=True)
            raise


def generate_document_summary(full_text: str) -> Optional[str]:
    """Generate a summary of the document using Vultr LLM."""
    logger.info(f"=== Summary Generation Started ===")
    logger.info(f"Input document text length: {len(full_text)} characters")
    
    try:
        vultr_api_key = os.getenv("VULTR_API_KEY")
        if not vultr_api_key:
            logger.warning("VULTR_API_KEY not found in environment variables, skipping summary generation")
            return None
        
        vultr_model = os.getenv("VULTR_MODEL", "mistral-nemo-instruct-240")
        logger.info(f"Initializing Vultr LLM with model: {vultr_model}")
        llm = VultrLLM(api_key=vultr_api_key, model=vultr_model)
        
        logger.info("Calling LLM to generate document summary")
        summary = llm.generate_summary(full_text)
        
        if summary:
            logger.info(f"=== Summary Generation Completed Successfully ===")
            logger.info(f"Final summary length: {len(summary)} characters")
            # Log word count
            word_count = len(summary.split())
            logger.info(f"Summary word count: {word_count} words")
            # Log first 300 characters as preview
            preview = summary[:300] + "..." if len(summary) > 300 else summary
            logger.debug(f"Summary preview (first 300 chars): {preview}")
        else:
            logger.warning("Summary generation returned empty result")
        
        return summary
        
    except Exception as e:
        logger.error(f"=== Summary Generation Failed ===")
        logger.error(f"Error generating document summary: {str(e)}", exc_info=True)
        return None

