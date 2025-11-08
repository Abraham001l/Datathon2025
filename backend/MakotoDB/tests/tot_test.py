import requests
import os
from dotenv import load_dotenv
from tree_of_thoughts import TotAgent, ToTDFSAgent

# Load environment variables from .env file
load_dotenv()

# Getting  Vultr API Key
VULTR_API_KEY = os.getenv("VULTR_API_KEY")


class VultrAgent:
    def __init__(self, api_key, model):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.vultrinference.com/v1/chat/completions"

    def call(self, prompt, temperature):
        # Defining message
        data = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful assistant"
                },
                {
                    "role": "user",
                    "content":  prompt
                }
            ],
            "temperature": temperature
        }
        headers={
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Making POST request
        response = requests.post(
            self.vultr_url,
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

# Warpping Vultr Model
vultr_agent = VultrAgent(VULTR_API_KEY, "kimi-k2-instruct")

# Initializing TotAgent with OpenAI disabled
tot_agent = TotAgent(use_openai_caller=False)

# Patch the TotAgent to use our Vultr Agent
tot_agent.call = vultr_agent.call

# Initialize DFS Agent
dfs_agent = ToTDFSAgent(
    agent=tot_agent,
    threshold=0.8,
    max_loops=3,
    prune_threshold=0.5,
    number_of_agents=4
)

# Define the problem
initial_state = "Your task: is to use 4 numbers and basic arithmetic operations (+-*/) to obtain 24 in 1 equation, return only the math"

# Run DFS
final_thought = dfs_agent.run(initial_state)
print(final_thought)