import os
with open("backend/main.py", "r") as f:
    content = f.read()

if "from routers import debug" not in content:
    content = content.replace("from routers import jobs", "from routers import jobs\nfrom routers import debug")
    content = content.replace("app.include_router(jobs.router, prefix=\"/api/jobs\", tags=[\"jobs\"])", "app.include_router(jobs.router, prefix=\"/api/jobs\", tags=[\"jobs\"])\napp.include_router(debug.router, tags=[\"debug\"])")
    
    with open("backend/main.py", "w") as f:
        f.write(content)
