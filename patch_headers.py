with open("backend/routers/jobs.py", "r") as f:
    content = f.read()

content = content.replace(
    "return EventSourceResponse(event_generator())",
    'return EventSourceResponse(event_generator(), headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})'
)

with open("backend/routers/jobs.py", "w") as f:
    f.write(content)
