import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_R1_API_KEY")
url = "https://api.groq.com/openai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

prompt = "This is a dummy prompt. " * 3000  # ~15,000 tokens to force a 413 error

payload = {
    "model": "openai/gpt-oss-120b",
    "messages": [{"role": "user", "content": prompt}],
    "max_tokens": 4096
}

response = requests.post(url, headers=headers, json=payload)
print("Status Code:", response.status_code)
print("Response:", response.text)
