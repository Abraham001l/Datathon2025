import requests
import os
from dotenv import load_dotenv
from tree_of_thoughts import TotAgent, ToTDFSAgent
from vultr_agent import VultrLLM

# Load environment variables from .env file
load_dotenv()

# Getting  Vultr API Key
VULTR_API_KEY = os.getenv("VULTR_API_KEY")


# class VultrAgent:
#     def __init__(self, api_key, model):
#         self.api_key = api_key
#         self.model = model
#         self.url = "https://api.vultrinference.com/v1/chat/completions"

#     def run(self, prompt):
#         # Defining message
#         data = {
#             "model": self.model,
#             "messages": [
#                 {
#                     "role": "system",
#                     "content": "You are a helpful assistant"
#                 },
#                 {
#                     "role": "user",
#                     "content":  prompt
#                 }
#             ],
#             "temperature": 0.8
#         }
#         headers={
#             "Authorization": f"Bearer {self.api_key}",
#             "Content-Type": "application/json"
#         }

#         # Making POST request
#         response = requests.post(
#             self.url,
#             headers=headers,
#             json=data
#         )
#         response.raise_for_status()
#         return response.json()["choices"][0]["message"]["content"]

# Warpping Vultr Model
vultr_llm = VultrLLM(api_key=VULTR_API_KEY, model="kimi-k2-instruct")

# Initializing TotAgent with OpenAI disabled
tot_agent = TotAgent(
    use_openai_caller=False,  # Don't use OpenAI
    model=vultr_llm,
    max_loops=3,
    autosave_on=False  # Disable autosave to prevent file locking issues on Windows
)

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