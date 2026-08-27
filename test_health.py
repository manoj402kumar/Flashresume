import sys, os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import asyncio
from fastapi import Request
from backend.main import readiness

async def test():
    class DummyRequest:
        client = None
    try:
        res = await readiness(DummyRequest())
        print(res)
    except Exception as e:
        print(e)
asyncio.run(test())
