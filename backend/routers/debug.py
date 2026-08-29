import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import EventSourceResponse
from redis_client import redis_client

router = APIRouter()

@router.get("/debug/sse")
async def debug_sse(request: Request):
    async def generator():
        print("[debug_sse] stream_enter")
        try:
            while True:
                if await request.is_disconnected():
                    print("[debug_sse] request_disconnected")
                    break
                yield {"event": "heartbeat", "data": "ok"}
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            print("[debug_sse] generator_cancelled")
        except Exception as e:
            print(f"[debug_sse] generator_exception: {e}")
        finally:
            print("[debug_sse] generator_finally")
    return EventSourceResponse(generator())

@router.get("/debug/redis")
async def debug_redis(request: Request):
    async def generator():
        print("[debug_redis] stream_enter")
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("debug_channel")
        print("[debug_redis] subscription_started")
        try:
            while True:
                if await request.is_disconnected():
                    print("[debug_redis] request_disconnected")
                    break
                
                print("[debug_redis] pubsub_poll_start")
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message:
                    print(f"[debug_redis] pubsub_message_received: {message}")
                    yield {"event": "message", "data": message["data"].decode("utf-8") if isinstance(message["data"], bytes) else str(message["data"])}
                else:
                    print("[debug_redis] pubsub_poll_timeout/none")
                    yield {"event": "ping", "data": ""}
        except asyncio.CancelledError:
            print("[debug_redis] generator_cancelled")
        except Exception as e:
            print(f"[debug_redis] generator_exception: {type(e)} {e}")
        finally:
            await pubsub.unsubscribe("debug_channel")
            await pubsub.close()
            print("[debug_redis] generator_finally")
    return EventSourceResponse(generator())
