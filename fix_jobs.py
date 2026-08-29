with open("backend/routers/jobs.py", "r") as f:
    content = f.read()

# Let's fix lines around from redis_client import redis_client
import re
content = re.sub(r'        from redis_client import redis_client', r'    from redis_client import redis_client', content)
content = re.sub(r'    pubsub = redis_client.pubsub\(\)', r'    pubsub = redis_client.pubsub()', content)
with open("backend/routers/jobs.py", "w") as f:
    f.write(content)
