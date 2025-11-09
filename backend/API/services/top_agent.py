"""Tree of Prompts (ToP) Agent service for document classification."""
import os
import logging
from typing import List, Dict, Optional
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.llm import VultrLLM

load_dotenv()
logger = logging.getLogger(__name__)

# Get MAX_WORKERS from environment variable, default to 20
try:
    MAX_WORKERS = int(os.getenv("TOP_AGENT_MAX_WORKERS", "20"))
    if MAX_WORKERS < 1:
        logger.warning(f"TOP_AGENT_MAX_WORKERS must be >= 1, got {MAX_WORKERS}. Using default 20.")
        MAX_WORKERS = 20
except (ValueError, TypeError):
    logger.warning(f"Invalid TOP_AGENT_MAX_WORKERS value, using default 20.")
    MAX_WORKERS = 20


class ToP_Agent:
    """Tree of Prompts Agent for classifying documents into sensitivity categories."""
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize the ToP Agent.
        
        Args:
            api_key: Vultr API key. If not provided, will use VULTR_API_KEY from environment.
            model: Vultr model name. If not provided, will use VULTR_MODEL or default to "kimi-k2-instruct".
        """
        # Loading API Key
        self.VULTR_API_KEY = api_key or os.getenv("VULTR_API_KEY")
        if not self.VULTR_API_KEY:
            raise ValueError("VULTR_API_KEY not found in environment variables or provided parameter")

        # Making agent
        default_model = model or os.getenv("VULTR_MODEL", "kimi-k2-instruct")
        self.vultr_llm = VultrLLM(api_key=self.VULTR_API_KEY, model=default_model)
    
        self.sensitive_chain = [
        "Text contains personally identifiable information (PII) such as Social Security Numbers, credit card numbers, bank account details, phone numbers, or home addresses.",
        "Text references proprietary or restricted technical schematics, source code, or blueprints (e.g., defense, military, or next-generation product designs).",
        "Text includes internal identifiers, access credentials, or sensitive authentication data.",
        "Text explicitly mentions terms like 'restricted', 'classified', 'top secret', or similar sensitivity indicators.",
        """Classify if text is Sensitive/Highly Sensitive, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
        ]
        self.confidential_chain = [
        "Text contains references to internal company communications, such as internal memos, meeting notes, or strategic discussions.",
        "Text includes business documents, contracts, invoices, reports, or operational procedures not meant for public release.",
        "Text contains customer information such as names, emails, addresses, or account details shared in a non-public context.",
        """Text includes non-public business information, such as revenue, costs, pricing models, or product roadmaps.""",
        """Classify if text is Confidential, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
        ]
        self.public_chain = [
        "Text contains marketing or promotional content such as slogans, product descriptions, advertisements, or customer success stories.",
        "Text includes product brochures, datasheets, or publicly distributed informational materials.",
        "Text comes from a public website, press release, social media post, or other open-access communication.",
        "Text includes generic, non-confidential information or references to common industry terms, technologies, or concepts that are already public.",
        """Classify if text is Public, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
        ]
        self.unsafe_chain = [
        "Text contains or references hate speech, discrimination, or derogatory language against any individual or group.",
        "Text includes explicit, violent, exploitative, or sexually inappropriate material, including any child-related exploitation or abuse.",
        "Text discusses or promotes criminal activity, terrorism, or illegal actions such as hacking, fraud, or weapon use.",
        "Text contains political propaganda, extremist content, or cyber-threat information such as phishing, malware, or system intrusion attempts.",
        """Classify if text is Unsafe Content, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
        ]
        self.tree = [self.sensitive_chain, self.confidential_chain, self.public_chain, self.unsafe_chain]
    
    def ai_chain_edit(self, tree_index: int, suggestion: str) -> List[str]:
        """Edit a chain using AI to generate a new prompt based on a suggestion.
        
        Args:
            tree_index: Index of the chain to edit (0=sensitive, 1=confidential, 2=public, 3=unsafe)
            suggestion: Suggestion for what the new prompt should address
            
        Returns:
            The updated chain
        """
        existing_prompts = "\n".join(self.tree[tree_index][:-1])

        prompt = f"""Given these existing prompts for a category:
{existing_prompts}

Create a new prompt that addresses this suggestion:
{suggestion}

Output only the new prompt. Do not repeat the existing prompts."""
        response = self.vultr_llm.run(prompt)
        self.tree[tree_index].insert(-1, response)
        return self.tree[tree_index]

    def human_chain_edit(self, tree_index: int, chain_index: int, new_text: str):
        """Manually edit a specific prompt in a chain.
        
        Args:
            tree_index: Index of the chain to edit
            chain_index: Index of the prompt within the chain
            new_text: New text for the prompt
        """
        self.tree[tree_index][chain_index] = new_text

    def human_chain_add(self, tree_index: int, new_text: str):
        """Manually add a new prompt to a chain.
        
        Args:
            tree_index: Index of the chain to add to
            new_text: New prompt text to add
        """
        self.tree[tree_index].insert(-1, new_text)
    
    def human_chain_remove(self, tree_index: int, chain_index: int):
        """Manually remove a prompt from a chain.
        
        Args:
            tree_index: Index of the chain to remove from
            chain_index: Index of the prompt to remove
        """
        self.tree[tree_index].pop(chain_index)

    def run_doc(self, blocks: List[str], summary: str = "") -> List[Dict[str, str]]:
        """Run classification on multiple document blocks in parallel.
        
        Args:
            blocks: List of text blocks to classify
            summary: Optional summary of the full document
            
        Returns:
            List of classification results, each containing prompt and response data
        """
        block_results = []
        summary_prompt = f"""Here is the summary of the full document from which this chunk was taken:
{summary}

Text: """

        # Adding summary to each block
        for i in range(len(blocks)):
            blocks[i] = summary_prompt + blocks[i]

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submitting blocks to executors
            future_to_block = {executor.submit(self.run, block): block for block in blocks}

            # Collect responses as they complete
            for future in as_completed(future_to_block):
                block = future_to_block[future]
                try:
                    response = future.result()
                    block_results.append(response)
                except Exception as e:
                    logger.error(f"Prompt failed for block: {block[:100]}..., Error: {e}")
                    # Append error result
                    block_results.append({"error": str(e), "block_preview": block[:100]})
        return block_results
                    

    def run(self, context: str) -> Dict[str, str]:
        """Run classification on a single text context.
        
        Args:
            context: Text to classify
            
        Returns:
            Dictionary containing classification results with prompt and response data
        """
        results = []
        classification = self.pick_chain(context, results)
        self.run_chain(index=0, old_conversation=context, classification=classification, results=results)

        data = {}
        for i in range(len(results)):
            data[f"prompt_{str(i)}"] = results[i][0]
            data[f"response_{str(i)}"] = results[i][1]
        
        return data

    def run_chain(self, index: int, old_conversation: str, classification: int, results: List[List[str]]):
        """Recursively run through a classification chain.
        
        Args:
            index: Current index in the chain
            old_conversation: Previous conversation context
            classification: Classification category index
            results: List to store results
        """
        prompt = f"""{old_conversation}
        
New Task:
{self.tree[classification][index]}"""

        response = self.vultr_llm.run(prompt)
        results.append([f"New Task:\n{self.tree[classification][index]}", response])
        conversation = prompt + "\n" + response

        # Checking if finished iteration
        if index == len(self.tree[classification])-1:
            return
        
        # Recursively running through chain
        self.run_chain(index+1, conversation, classification, results)

    def pick_chain(self, context: str, results: List[List[str]]) -> int:
        """Pick the appropriate classification chain for the context.
        
        Args:
            context: Text to classify
            results: List to store results
            
        Returns:
            Classification category index (0=sensitive, 1=confidential, 2=public, 3=unsafe)
        """
        prompt = f"""Classify the following text into the single most appropriate category:

        0 — Sensitive/Highly Sensitive: Contains PII (e.g., SSNs, account/credit card numbers) or proprietary schematics (e.g., defense or next-gen product designs).  
        1 — Confidential: Internal business documents, customer data, or other non-public content.  
        2 — Public: Marketing materials, public website content, or generic, non-sensitive information.  
        3 — Unsafe Content: Hate speech, exploitative, violent, criminal, political, or cyber-threat material.

        {context}

        Format for output:
        Classification: 0, 1, 2, or 3
        """

        response = self.vultr_llm.run(prompt)
        results.append([prompt, response])
        
        # Extract classification number from response
        try:
            # Try to find "Classification: X" or just a number
            for word in response.split():
                if word.isdigit():
                    classification = int(word)
                    if 0 <= classification <= 3:
                        return classification
            # Fallback: try to parse from response
            return int(response.split()[1])
        except (IndexError, ValueError) as e:
            logger.warning(f"Failed to parse classification from response: {response}. Defaulting to 2 (Public).")
            return 2  # Default to public if parsing fails


# Global instance (singleton pattern)
_top_agent_instance: Optional[ToP_Agent] = None


def get_top_agent() -> ToP_Agent:
    """Get or create the global ToP Agent instance.
    
    Returns:
        ToP_Agent instance
    """
    global _top_agent_instance
    if _top_agent_instance is None:
        _top_agent_instance = ToP_Agent()
    return _top_agent_instance

