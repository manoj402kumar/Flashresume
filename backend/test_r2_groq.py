import os
import requests
from dotenv import load_dotenv
from prompts.generation_prompt import GENERATION_PROMPT

load_dotenv()

api_key = os.getenv("GROQ_R1_API_KEY")
url = "https://api.groq.com/openai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Create a realistic sized resume and JD
resume_text = "This is a realistic resume word. " * 500  # ~800 tokens
job_description = "This is a realistic JD word. " * 300 # ~500 tokens

prompt = GENERATION_PROMPT.format(
    resume_text=resume_text,
    job_description=job_description,
    ats_score_before=50,
    missing_keywords="Python, Docker",
    selected_projects="Project 1",
    approved_project="none"
)

# Test with max_tokens = 3000
payload = {
    "model": "openai/gpt-oss-120b",
    "messages": [{"role": "user", "content": prompt}],
    "max_tokens": 500
}

response = requests.post(url, headers=headers, json=payload)
print("Status Code with 3000 max_tokens:", response.status_code)
if response.status_code == 413:
    print("Error:", response.text)
else:
    print("Success! R2 passes with 3000 max_tokens.")

