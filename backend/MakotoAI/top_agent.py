import os
from dotenv import load_dotenv
from vultr_llm_top import Vultr_LLM

class ToP_Agent:
    def __init__(self):
         # Loading API Key
        load_dotenv()
        self.VULTR_API_KEY = os.getenv("VULTR_API_KEY")

        # Making agent
        self.vultr_llm = Vultr_LLM(api_key=self.VULTR_API_KEY, model="kimi-k2-instruct")
    
        self.sensitive_chain = [
        "Text contains personally identifiable information (PII) such as Social Security Numbers, credit card numbers, bank account details, phone numbers, or home addresses.",
        "Text references proprietary or restricted technical schematics, source code, or blueprints (e.g., defense, military, or next-generation product designs).",
        "Text includes internal identifiers, access credentials, or sensitive authentication data.",
        "Text explicitly mentions terms like 'restricted', 'classified', 'top secret', or similar sensitivity indicators.",
        """Classify if text is Sensitive/Highly Sensitive, and give a confidence score.
        Format for output:
        Yes/No: 0 or 1
        Confidence: 0-1
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
        Confidence: 0-1
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
        Confidence: 0-1
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
        Confidence: 0-1
        Explanation: ..."""
        ]
        self.tree = [self.sensitive_chain, self.confidential_chain, self.public_chain, self.unsafe_chain]

    def run(self, text):
        classification = self.pick_chain(text)
        self.run_chain(index=0, old_conversation="", classification=classification)
        
    def run_chain(self, index, old_conversation, classification):
        prompt = f"""Conversation History:
        {old_conversation}
        
        New Task:
        {self.tree[classification][index]}"""

        response = self.vultr_llm.run(prompt)
        conversation =  prompt + "\n" + response

        # Checking if finished iteration
        if index == len(self.tree[classification])-1:
            print(conversation)
            return
        
        # Recursively running through chain
        self.run_chain(index+1, conversation, classification)

    def pick_chain(self, text):
        prompt = f"""Classify the following text into the single most appropriate category:

        0 — Sensitive/Highly Sensitive: Contains PII (e.g., SSNs, account/credit card numbers) or proprietary schematics (e.g., defense or next-gen product designs).  
        1 — Confidential: Internal business documents, customer data, or other non-public content.  
        2 — Public: Marketing materials, public website content, or generic, non-sensitive information.  
        3 — Unsafe Content: Hate speech, exploitative, violent, criminal, political, or cyber-threat material.

        Text:
        {text}

        Format for output:
        Classification: 0, 1, 2, or 3
        """

        response = self.vultr_llm.run(prompt)
        print(response)
        return int(response.split()[1])
    

top_agent = ToP_Agent()
top_agent.run(""" Kind of position or job for which you are applying (give the job title or job announcement number)
 Customer Service Representative
 2.   Other positions for which you would like to be considered      Loan Officer or New Account Representative
 3.   Name (Last, First, Middle)   Simmons, Susan J.
 4.   Street address   (No P.O. Box Numbers) 127 Blackrock Drive""")