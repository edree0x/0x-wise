# syntax=docker/dockerfile:1

FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models \
    OXW_MEDIA_DIR=/data/media

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgomp1 \
        ca-certificates \
        gosu \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

COPY worker.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD test -f /tmp/worker.heartbeat && [ $(($(date +%s) - $(stat -c %Y /tmp/worker.heartbeat))) -le 120 ] || exit 1

VOLUME ["/models", "/data"]
ENTRYPOINT ["./entrypoint.sh"]
