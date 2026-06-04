import asyncio
from llm.master_llm_caller import call_llm_balanced

async def test():
    print("Testing magistral-medium-latest...")
    try:
        res = await call_llm_balanced("Hello. Say 'Ping'.", is_r1=True, preferred_model="magistral-medium-latest")
        print("Result:", res)
    except Exception as e:
        print("Exception:", type(e), repr(e))

if __name__ == "__main__":
    asyncio.run(test())
