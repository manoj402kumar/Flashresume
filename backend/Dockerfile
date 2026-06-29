FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 8000

# Run Gunicorn with Uvicorn workers and worker-cycling to prevent Out Of Memory (OOM) on free tiers
# --max-requests 500 tells it to silently restart the worker every ~500 requests to clear any memory leaks
CMD gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --max-requests 500 --max-requests-jitter 50 --timeout 120 --bind 0.0.0.0:${PORT:-8000}
