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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

COPY worker.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

VOLUME ["/models", "/data"]
ENTRYPOINT ["./entrypoint.sh"]
