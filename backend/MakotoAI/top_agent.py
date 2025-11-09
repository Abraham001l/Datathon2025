import os
from dotenv import load_dotenv
from vultr_llm_top import Vultr_LLM
from concurrent.futures import ThreadPoolExecutor, as_completed

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
    
    def ai_chain_edit(self, tree_index, suggestion):
        existing_prompts = "\n".join(self.tree[tree_index][:-1])

        prompt = f"""Given these existing prompts for a category:
{existing_prompts}

Create a new prompt that addresses this suggestion:
{suggestion}

Output only the new prompt. Do not repeat the existing prompts."""
        response = self.vultr_llm.run(prompt)
        self.tree[tree_index].insert(-1, response)
        return self.tree[tree_index]

    def human_chain_edit(self, tree_index, chain_index, new_text):
        self.tree[tree_index][chain_index] = new_text

    def human_chain_add(self, tree_index, new_text):
        self.tree[tree_index].append(new_text)
    
    def human_chain_remove(self, tree_index, chain_index):
        self.tree[tree_index].pop(chain_index)

    def run_doc(self, blocks):
        block_results = []
        with ThreadPoolExecutor(max_workers=20) as executor:
            # Submitting blocks to executors
            future_to_block = {executor.submit(self.run, block): block for block in blocks}

            # Collect responses as they complete
            for future in as_completed(future_to_block):
                block = future_to_block[future]
                try:
                    response = future.result()
                    block_results.append(response)
                except Exception as e:
                    print(f"Prompt failed: {block}, Error: {e}")
        return block_results
                    

    def run(self, text):
        results = []
        classification = self.pick_chain(text, results)
        self.run_chain(index=0, old_conversation=f"Text: {text}", classification=classification, results=results)

        data = {}
        for i in range(len(results)):
            data[f"prompt_{str(i)}"] = results[i][0]
            data[f"response_{str(i)}"] = results[i][1]
        
        return data

    def run_chain(self, index, old_conversation, classification, results):
        prompt = f"""{old_conversation}
        
New Task:
{self.tree[classification][index]}"""

        response = self.vultr_llm.run(prompt)
        results.append([f"New Task:\n{self.tree[classification][index]}", response])
        conversation =  prompt + "\n" + response

        # Checking if finished iteration
        if index == len(self.tree[classification])-1:
            return
        
        # Recursively running through chain
        self.run_chain(index+1, conversation, classification, results)

    def pick_chain(self, text, results):
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
        results.append([prompt, response])
        return int(response.split()[1])
    

top_agent = ToP_Agent()
doc = [
"""Kind of position or job for which you are applying (give the job title or job announcement number)
 Customer Service Representative
 2.   Other positions for which you would like to be considered      Loan Officer or New Account Representative
 3.   Name (Last, First, Middle)   Simmons, Susan J.
 4.   Street address   (No P.O. Box Numbers) 127 Blackrock Drive""",
""" 5.   Apartment number        #105
 6.   City Anytown 7.   State  Virginia 8.   Zip          99999
 9.  If mailing address is different, provide address  P.O. Box 199, Anytown, VA 99999 10.   E-mail address         Susan123@aol.com
 11.  Telephone number (999) 555-0010 12.   Cell phone number  (999) 555-9919
 13.  Have you ever been employed by this company?                 G  Yes           :  No     
       If yes,  provide dates of employment:   From:   Month _________        Yr ___________   to        Month ________________   Yr_______________""",
"""What starting salary would be acceptable to you? 
 Per hour _Negotiable_________________  Per month  _________________
 15.  When would be the earliest date that you would be available to start work?
 Month __March__________ Day___1st___________    Year __2011________
 16.  Are you available for: Yes No
 Part-time work : G
 To relocate G :
 Overnight travel : G
                                                   
17.  Would you consider temporary work of:
 Yes No
 Less than 3 months G :
 3 - 6 months G :
 9 - 12 months : G
 18.  Hours preferred: No preference G or Start work at ________8 a.m._________________________    (enter time of day).
       Days of the week: No preference : or Circle the days of the week that you prefer to work: 
Sun          Mon          Tues          Wed          Thur          Fri          Sat"""
]
# print(top_agent.run_doc(doc))
print(top_agent.ai_chain_edit(0, "add detection for api keys"))