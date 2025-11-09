import requests
import re

class VultrLLM:
    def __init__(self, api_key: str, model="mistral-nemo-instruct-240"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.vultrinference.com/v1/chat/completions"

    def run(self, **kwargs) -> str:
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": kwargs.get("task")}
            ],
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 512)
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        response = requests.post(self.url, headers=headers, json=data)
        response.raise_for_status()
        out = response.json()["choices"][0]["message"]["content"]
        return out