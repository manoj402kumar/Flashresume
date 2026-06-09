FROM python:3.11-slim

# Install system dependencies (Tesseract OCR for scanned PDF fallback)
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 8000

# Run Uvicorn with a single worker to prevent Out Of Memory (OOM) on free tiers
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
