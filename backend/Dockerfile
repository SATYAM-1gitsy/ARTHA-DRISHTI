FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app/backend

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY pyproject.toml /app/pyproject.toml

EXPOSE 8000
CMD ["uvicorn", "drishti.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
