import os
import requests
from dotenv import load_dotenv

load_dotenv()

NVIDIA_KEY = os.getenv("NVIDIA_R1_API_KEY")

def fetch_nvidia_models():
    url = "https://integrate.api.nvidia.com/v1/models"
    headers = {
        "Authorization": f"Bearer {NVIDIA_KEY}",
        "Accept": "application/json"
    }
    
    print("Fetching available models from NVIDIA API...")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            models = data.get("data", [])
            print(f"\nSuccessfully fetched {len(models)} models!\n")
            
            # Group by publisher/org (e.g., 'meta', 'mistralai')
            grouped_models = {}
            for m in models:
                model_id = m.get("id", "")
                if "/" in model_id:
                    org = model_id.split("/")[0]
                else:
                    org = "other"
                
                if org not in grouped_models:
                    grouped_models[org] = []
                grouped_models[org].append(model_id)
            
            # Print grouped models
            for org in sorted(grouped_models.keys()):
                print(f"--- {org.upper()} ---")
                for model_id in sorted(grouped_models[org]):
                    print(f" - {model_id}")
                print()
        else:
            print(f"Failed to fetch models: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error fetching models: {e}")

if __name__ == "__main__":
    fetch_nvidia_models()
