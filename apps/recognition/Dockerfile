FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/models \
    HF_HOME=/models/huggingface \
    WHISPER_MODEL=base \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE_TYPE=int8 \
    MAX_MEDIA_SIZE_MB=10 \
    MAX_AUDIO_SECONDS=60

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --home-dir /app --shell /usr/sbin/nologin app \
    && mkdir -p /models \
    && chown -R app:app /models
WORKDIR /app
COPY apps/recognition/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/recognition/worker.py apps/recognition/preload_models.py ./
USER app
EXPOSE 8000
CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--log-level", "warning"]
