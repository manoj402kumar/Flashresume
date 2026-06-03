import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv('backend/.env')

api_key = os.getenv('DEEPSEEK_API_KEY')
print(f"API Key loaded: {'YES' if api_key else 'NO'}")

client = OpenAI(api_key=api_key, base_url='https://api.deepseek.com/v1')

try:
    response = client.chat.completions.create(
        model='deepseek-v4-flash',
        messages=[{'role': 'user', 'content': 'Say hello in 3 words.'}],
        max_tokens=10
    )
    print("SUCCESS:", response.model_dump_json(indent=2))
except Exception as e:
    print("ERROR:", str(e))
