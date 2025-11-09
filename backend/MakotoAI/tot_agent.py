import requests
import os
import json
from dotenv import load_dotenv
from tree_of_thoughts import TotAgent, ToTDFSAgent
from vultr_llm_tot import Vultr_LLM

class ToT_Agent:
    def __init__(self, max_loops_):
        # Loading API Key
        load_dotenv()
        self.VULTR_API_KEY = os.getenv("VULTR_API_KEY")

        # Making agent
        self.vultr_llm = Vultr_LLM(api_key=self.VULTR_API_KEY, model="kimi-k2-instruct")
        self.tot_agent = TotAgent(
            use_openai_caller=False,
            model=self.vultr_llm,
            max_loops=max_loops_,
            autosave_on=False,
        )
        self.dfs_agent = ToTDFSAgent(
            agent=self.tot_agent,
            threshold=0.9,
            max_loops=max_loops_,
            prune_threshold=0.5,
            number_of_agents=4
        )

    def train_tree(self, text):
        # Running dfs
        result_json = self.dfs_agent.run(f"""Classify the following test according to this category (0 or 1) and give a confidence score (0 to 1):
        Sensitive/Highly Sensitive: Content that includes PII like SSNs, account/credit card numbers, and proprietary schematics (e.g., defense or next‑gen product designs of military equipment).
        
        Text: {text}
        
        Return the Result in this format:
        classification: #
        confidence: #.#""")

        # Getting result
        result = json.loads(result_json)
        print(result)


tot_agent = ToT_Agent(3)
tot_agent.train_tree("""on opportunities regardless of partner business model or  
go-to-market investment. This offers a range from  
subscription and consumption-based storage or converged 
infrastructure with data protection services. Delivery is 
available as self-managed by either the partner or end-user, 
shared-managed by the partner and Hitachi Vantara, or with 
full Hitachi Managed Services. Hitachi Managed Services and 
EverFlex Control can also be white labeled by partners, giving 
them instant as-a-service capabilities with zero organizational 
investment.""")