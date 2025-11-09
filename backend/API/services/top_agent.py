"""Tree of Prompts (ToP) Agent service for document classification."""
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.llm import VultrLLM

load_dotenv()
logger = logging.getLogger(__name__)

# Path to chains storage file
CHAINS_FILE = Path(__file__).parent / "top_agent_chains.json"

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
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, chains_file: Optional[Path] = None):
        """Initialize the ToP Agent.
        
        Args:
            api_key: Vultr API key. If not provided, will use VULTR_API_KEY from environment.
            model: Vultr model name. If not provided, will use VULTR_MODEL or default to "kimi-k2-instruct".
            chains_file: Path to chains storage file. If not provided, uses default location.
        """
        # Loading API Key
        self.VULTR_API_KEY = api_key or os.getenv("VULTR_API_KEY")
        if not self.VULTR_API_KEY:
            raise ValueError("VULTR_API_KEY not found in environment variables or provided parameter")

        # Making agent
        default_model = model or os.getenv("VULTR_MODEL", "kimi-k2-instruct")
        self.vultr_llm = VultrLLM(api_key=self.VULTR_API_KEY, model=default_model)
        
        # Set chains file path
        self.chains_file = chains_file or CHAINS_FILE
        
        # Load chains from file (or create with defaults if file doesn't exist)
        self._load_chains()
    
    def _get_default_chains(self) -> Dict[str, List[str]]:
        """Get default chains structure."""
        return {
            "sensitive": [
                "Text contains personally identifiable information (PII) such as Social Security Numbers, credit card numbers, bank account details, phone numbers, or home addresses.",
                "Text references proprietary or restricted technical schematics, source code, or blueprints (e.g., defense, military, or next-generation product designs).",
                "Text includes internal identifiers, access credentials, or sensitive authentication data.",
                "Text explicitly mentions terms like 'restricted', 'classified', 'top secret', or similar sensitivity indicators.",
                """Classify if text is Sensitive/Highly Sensitive, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
            ],
            "confidential": [
                "Text contains references to internal company communications, such as internal memos, meeting notes, or strategic discussions.",
                "Text includes business documents, contracts, invoices, reports, or operational procedures not meant for public release.",
                "Text contains customer information such as names, emails, addresses, or account details shared in a non-public context.",
                """Text includes non-public business information, such as revenue, costs, pricing models, or product roadmaps.""",
                """Classify if text is Confidential, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
            ],
            "public": [
                "Text contains marketing or promotional content such as slogans, product descriptions, advertisements, or customer success stories.",
                "Text includes product brochures, datasheets, or publicly distributed informational materials.",
                "Text comes from a public website, press release, social media post, or other open-access communication.",
                "Text includes generic, non-confidential information or references to common industry terms, technologies, or concepts that are already public.",
                """Classify if text is Public, and give a confidence score.
Format for output:
Yes/No: 0 or 1
Confidence: 0-1 (0 if Yes/No is 0)
Explanation: ..."""
            ],
            "unsafe": [
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
        }
    
    def _load_chains(self):
        """Load chains from file, or create default chains if file doesn't exist."""
        try:
            if self.chains_file.exists():
                logger.info(f"Loading chains from {self.chains_file}")
                with open(self.chains_file, 'r', encoding='utf-8') as f:
                    chains_data = json.load(f)
                
                # Validate and load chains
                self.sensitive_chain = chains_data.get("sensitive", self._get_default_chains()["sensitive"])
                self.confidential_chain = chains_data.get("confidential", self._get_default_chains()["confidential"])
                self.public_chain = chains_data.get("public", self._get_default_chains()["public"])
                self.unsafe_chain = chains_data.get("unsafe", self._get_default_chains()["unsafe"])
                
                logger.info("Chains loaded successfully from file")
            else:
                logger.info(f"Chains file not found at {self.chains_file}, creating with default chains")
                # Load defaults
                default_chains = self._get_default_chains()
                self.sensitive_chain = default_chains["sensitive"]
                self.confidential_chain = default_chains["confidential"]
                self.public_chain = default_chains["public"]
                self.unsafe_chain = default_chains["unsafe"]
                # Save defaults to file
                self._save_chains()
        except Exception as e:
            logger.error(f"Error loading chains from file: {str(e)}", exc_info=True)
            logger.warning("Falling back to default chains")
            # Load defaults on error
            default_chains = self._get_default_chains()
            self.sensitive_chain = default_chains["sensitive"]
            self.confidential_chain = default_chains["confidential"]
            self.public_chain = default_chains["public"]
            self.unsafe_chain = default_chains["unsafe"]
        
        # Set tree reference
        self.tree = [self.sensitive_chain, self.confidential_chain, self.public_chain, self.unsafe_chain]
    
    def _save_chains(self):
        """Save chains to file."""
        try:
            chains_data = {
                "sensitive": self.sensitive_chain,
                "confidential": self.confidential_chain,
                "public": self.public_chain,
                "unsafe": self.unsafe_chain
            }
            
            # Ensure directory exists
            self.chains_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Write to file with pretty formatting
            with open(self.chains_file, 'w', encoding='utf-8') as f:
                json.dump(chains_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Chains saved to {self.chains_file}")
        except Exception as e:
            logger.error(f"Error saving chains to file: {str(e)}", exc_info=True)
            raise
    
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
        # Update individual chain reference
        self._update_chain_references()
        # Save to file
        self._save_chains()
        return self.tree[tree_index]

    def human_chain_edit(self, tree_index: int, chain_index: int, new_text: str):
        """Manually edit a specific prompt in a chain.
        
        Args:
            tree_index: Index of the chain to edit
            chain_index: Index of the prompt within the chain
            new_text: New text for the prompt
        """
        self.tree[tree_index][chain_index] = new_text
        # Update individual chain reference
        self._update_chain_references()
        # Save to file
        self._save_chains()

    def human_chain_add(self, tree_index: int, new_text: str):
        """Manually add a new prompt to a chain.
        
        Args:
            tree_index: Index of the chain to add to
            new_text: New prompt text to add
        """
        self.tree[tree_index].insert(-1, new_text)
        # Update individual chain reference
        self._update_chain_references()
        # Save to file
        self._save_chains()
    
    def human_chain_remove(self, tree_index: int, chain_index: int):
        """Manually remove a prompt from a chain.
        
        Args:
            tree_index: Index of the chain to remove from
            chain_index: Index of the prompt to remove
        """
        self.tree[tree_index].pop(chain_index)
        # Update individual chain reference
        self._update_chain_references()
        # Save to file
        self._save_chains()
    
    def _update_chain_references(self):
        """Update individual chain references to match tree."""
        self.sensitive_chain = self.tree[0]
        self.confidential_chain = self.tree[1]
        self.public_chain = self.tree[2]
        self.unsafe_chain = self.tree[3]

    def run_doc(self, blocks: List[str], summary: str = "") -> List[Dict[str, str]]:
        """Run classification on multiple document blocks in parallel.
        
        Args:
            blocks: List of text blocks to classify
            summary: Optional summary of the full document
            
        Returns:
            List of classification results, each containing prompt and response data
        """
        logger.info(f"=== ToP Agent run_doc Started ===")
        logger.info(f"Number of blocks to classify: {len(blocks)}")
        
        if summary:
            logger.info(f"Document summary provided - Length: {len(summary)} characters")
            summary_word_count = len(summary.split())
            logger.info(f"Document summary word count: {summary_word_count} words")
            # Log summary preview
            summary_preview = summary[:200] + "..." if len(summary) > 200 else summary
            logger.debug(f"Summary preview: {summary_preview}")
        else:
            logger.warning("No document summary provided - classification will proceed without document context")
        
        block_results = []
        summary_prompt = f"""Here is the summary of the full document from which this chunk was taken:
{summary}

Text: """

        # Adding summary to each block
        logger.info(f"Prepending summary to {len(blocks)} blocks for classification")
        for i in range(len(blocks)):
            original_block_length = len(blocks[i])
            blocks[i] = summary_prompt + blocks[i]
            logger.debug(f"Block {i}: Original length {original_block_length} chars, With summary: {len(blocks[i])} chars")
        
        logger.info(f"Starting parallel classification with {MAX_WORKERS} workers")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submitting blocks to executors
            future_to_block = {executor.submit(self.run, block): block for block in blocks}

            # Collect responses as they complete
            completed_count = 0
            for future in as_completed(future_to_block):
                block = future_to_block[future]
                try:
                    response = future.result()
                    block_results.append(response)
                    completed_count += 1
                    if completed_count % 10 == 0 or completed_count == len(blocks):
                        logger.info(f"Classification progress: {completed_count}/{len(blocks)} blocks completed")
                except Exception as e:
                    logger.error(f"Prompt failed for block (first 100 chars): {block[:100]}..., Error: {e}")
                    # Append error result
                    block_results.append({"error": str(e), "block_preview": block[:100]})
                    completed_count += 1
        
        logger.info(f"=== ToP Agent run_doc Completed ===")
        logger.info(f"Total results: {len(block_results)}, Successful: {sum(1 for r in block_results if 'error' not in r)}, Failed: {sum(1 for r in block_results if 'error' in r)}")
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

