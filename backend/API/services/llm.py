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
    
    def __init__(self, api_key: str, model: str = "mistral-nemo-instruct-240"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.vultrinference.com/v1/chat/completions"

    def generate_summary(self, text: str, max_tokens: int = 500) -> str:
        """Generate a summary of the provided text."""
        if not text or not text.strip():
            return "No text content available for summary."
        
        # Truncate text if too long (limit to ~8000 chars to avoid token limits)
        MAX_TEXT_LENGTH = 8000
        if len(text) > MAX_TEXT_LENGTH:
            text_to_summarize = text[:MAX_TEXT_LENGTH] + "\n\n[Document truncated for summarization]"
        else:
            text_to_summarize = text
        
        prompt = f"""Please provide a concise summary of the following document. Focus on the main topics, key points, and important information.

Document text:
{text_to_summarize}

Summary:"""

        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that provides clear and concise document summaries."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": max_tokens
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(self.url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            summary = response.json()["choices"][0]["message"]["content"]
            return summary.strip()
        except Exception as e:
            logger.error(f"Error generating summary with Vultr LLM: {str(e)}", exc_info=True)
            raise


def generate_document_summary(full_text: str) -> Optional[str]:
    """Generate a summary of the document using Vultr LLM."""
    try:
        vultr_api_key = os.getenv("VULTR_API_KEY")
        if not vultr_api_key:
            logger.warning("VULTR_API_KEY not found in environment variables, skipping summary generation")
            return None
        
        vultr_model = os.getenv("VULTR_MODEL", "mistral-nemo-instruct-240")
        llm = VultrLLM(api_key=vultr_api_key, model=vultr_model)
        
        logger.info("Generating document summary with Vultr LLM")
        summary = llm.generate_summary(full_text)
        logger.info(f"Summary generated: {len(summary)} characters")
        return summary
        
    except Exception as e:
        logger.error(f"Failed to generate document summary: {str(e)}", exc_info=True)
        return None

