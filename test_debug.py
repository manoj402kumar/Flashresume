import asyncio
import httpx

async def test_sse():
    print("Testing /debug/sse")
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", "http://localhost:8000/debug/sse") as response:
                count = 0
                async for line in response.aiter_lines():
                    print(line)
                    count += 1
                    if count >= 3:
                        break
        except Exception as e:
            print(f"Exception: {e}")

async def test_redis():
    print("Testing /debug/redis")
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("GET", "http://localhost:8000/debug/redis") as response:
                count = 0
                async for line in response.aiter_lines():
                    print(line)
                    count += 1
                    if count >= 3:
                        break
        except Exception as e:
            print(f"Exception: {e}")

async def main():
    await test_sse()
    await test_redis()

asyncio.run(main())
