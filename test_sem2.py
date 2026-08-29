import asyncio
import traceback

sem = asyncio.Semaphore(4)

async def worker_loop():
    print("Starting worker loop")
    try:
        await sem.acquire()
        print("Acquired!")
    except Exception as e:
        print("Exception caught:", repr(e))
        traceback.print_exc()

loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
loop.run_until_complete(worker_loop())
