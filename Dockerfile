FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ /app/src/

# Railway (and other PaaS) set PORT; default 8080 for local docker.
# Override for worker: CMD ["python", "-m", "venuenav.workers.map_worker"]
CMD ["/bin/sh", "-c", "exec uvicorn venuenav.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
