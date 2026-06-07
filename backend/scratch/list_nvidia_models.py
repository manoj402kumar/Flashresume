import os
import httpx
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("NVIDIA_R1_API_KEY")

def list_models():
    url = "https://integrate.api.nvidia.com/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    
    response = httpx.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        models = data.get("data", [])
        print("AVAILABLE NVIDIA MODELS:")
        for model in models:
            print(f"- {model['id']}")
    else:
        print(f"Failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    list_models()
