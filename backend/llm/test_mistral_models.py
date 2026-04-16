import os
import time
from dotenv import load_dotenv
from mistralai.client import Mistral

load_dotenv()

client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

TEST_PROMPT = """Return ONLY this JSON, no extra text:
{"status": "ok", "model": "working"}"""

# Only test chat-capable models (skip embeddings, OCR, audio, moderation, vibe-cli)
SKIP_KEYWORDS = ["embed", "ocr", "moderation", "voxtral", "vibe-cli", "devstral", "labs-"]

def should_skip(model_id: str) -> bool:
    return any(kw in model_id for kw in SKIP_KEYWORDS)

def test_model(model_id: str) -> dict:
    start = time.time()
    try:
        response = client.chat.complete(
            model=model_id,
            messages=[{"role": "user", "content": TEST_PROMPT}],
            max_tokens=50,
            temperature=0.1,
        )
        elapsed = round(time.time() - start, 2)
        text = response.choices[0].message.content.strip()
        return {"status": "PASS", "speed": f"{elapsed}s", "response": text[:60]}
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {"status": "FAIL", "speed": f"{elapsed}s", "response": str(e)[:80]}


if __name__ == "__main__":
    print("\n" + "="*70)
    print("   Mistral Model Tester — Verifying chat-capable models")
    print("="*70)

    models = client.models.list()
    model_ids = sorted([m.id for m in models.data if not should_skip(m.id)])
    print(f"\n  Found {len(model_ids)} chat models to test...\n")

    results = []
    for model_id in model_ids:
        print(f"  Testing: {model_id:<45}", end="", flush=True)
        result = test_model(model_id)
        print(f"{result['status']}  {result['speed']}")
        results.append({"model": model_id, **result})
        time.sleep(0.5)

    passed = [r for r in results if r["status"] == "PASS"]
    failed = [r for r in results if r["status"] == "FAIL"]

    print("\n" + "="*70)
    print(f"   RESULTS: {len(passed)} working  |  {len(failed)} failed")
    print("="*70)

    print("\n  WORKING MODELS:")
    for r in passed:
        print(f"     {r['model']:<45} {r['speed']}")

    if failed:
        print("\n  FAILED MODELS:")
        for r in failed:
            print(f"     {r['model']:<45} {r['response'][:60]}")
    print()
