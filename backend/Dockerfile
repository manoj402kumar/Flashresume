FROM python:3.11-slim

# Install system dependencies (including pdflatex and OCR tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a non-root user for security (unprivileged execution)
RUN useradd -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run Gunicorn with Uvicorn workers and worker-cycling to prevent Out Of Memory (OOM) on free tiers
# --max-requests 500 tells it to silently restart the worker every ~500 requests to clear any memory leaks
CMD gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --max-requests 500 --max-requests-jitter 50 --timeout 120 --bind 0.0.0.0:${PORT:-8000}
