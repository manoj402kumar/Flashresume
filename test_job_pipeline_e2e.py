import asyncio
import httpx
import json

async def run_e2e_test():
    base_url = "http://localhost:8000/api"
    
    print("1. Submitting parsing job...")
    with open("public/reference_Resume.pdf", "ab") as f:
        f.write(b" ") # make it unique
        
    async with httpx.AsyncClient() as client:
        with open("public/reference_Resume.pdf", "rb") as f:
            files = {'file': ("reference_Resume.pdf", f, "application/pdf")}
            resp = await client.post(f"{base_url}/parse", files=files)
            assert resp.status_code == 202, f"Failed to enqueue: {resp.text}"
            job_id = resp.json()["job_id"]
            print(f"✓ Job created: {job_id}")

    print("2. Verifying SSE Stream...")
    async with httpx.AsyncClient() as client:
        seen_status = False
        seen_result = False
        try:
            async with client.stream("GET", f"{base_url}/jobs/{job_id}/stream") as resp:
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("event:"):
                        event_type = line.split(":", 1)[1].strip()
                    elif line.startswith("data:"):
                        data = line.split(":", 1)[1].strip()
                        if event_type == "status":
                            status = json.loads(data).get("status")
                            print(f"  -> Status update: {status}")
                            if status == "COMPLETE":
                                seen_status = True
                        elif event_type == "result":
                            print("  -> Result received!")
                            seen_result = True
                            break
        except httpx.RemoteProtocolError:
            pass
            
        assert seen_status, "Never saw COMPLETE status in SSE"
        assert seen_result, "Never saw RESULT event in SSE (RACE CONDITION IF THIS FAILS)"
        print("✓ SSE stream successfully delivered the complete result!")

    print("All E2E pipeline tests passed!")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
