# syntax=docker/dockerfile:1.6
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

# Security: non-root user
RUN useradd -m appuser
WORKDIR /app

# System deps (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Python deps (layer cache)
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# App code
COPY app ./app

EXPOSE 8080
USER appuser

# Gunicorn with Uvicorn workers (production)
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "2", "-b", "0.0.0.0:8080", "app.main:app"]
