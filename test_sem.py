import asyncio

sem = asyncio.Semaphore(4)

async def worker_loop():
    while True:
        try:
            await sem.acquire()
            print("Acquired!")
            break
        except Exception as e:
            print("Exception:", repr(e))
            sem.release()
            await asyncio.sleep(1)

loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
loop.run_until_complete(worker_loop())
