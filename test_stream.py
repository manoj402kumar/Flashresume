import asyncio
import httpx
import json

async def run():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # Enqueue parse job
        print("Submitting parse job...")
        # Since parse takes a file, we need to upload a dummy file
        files = {'file': ('dummy.pdf', b'dummy content ' * 1000, 'application/pdf')}
        r = await client.post("/api/parse", files=files)
        job_id = r.json()["job_id"]
        print(f"Job ID: {job_id}")

        # Get ticket
        print("Getting ticket...")
        r = await client.post(f"/api/jobs/{job_id}/stream-ticket")
        ticket = r.json()["ticket"]
        print(f"Ticket: {ticket}")

        # Stream
        print("Streaming...")
        async with client.stream("GET", f"/api/jobs/{job_id}/stream?ticket={ticket}") as r:
            async for chunk in r.aiter_raw():
                print("CHUNK:", repr(chunk))

asyncio.run(run())
