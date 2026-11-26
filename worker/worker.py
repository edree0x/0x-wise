#!/usr/bin/env python3
"""0x wise worker.

Claims transcription jobs from the app, downloads episode audio locally, and
transcribes it with faster-whisper. Feed polling is also driven from here so a
single background service keeps the library fresh.

The worker never writes to SQLite directly: it talks to the app's
/api/worker/jobs and /api/cron/poll endpoints with OXW_CRON_TOKEN.
"""

from __future__ import annotations

import json
import os
import re
import signal
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = os.environ.get("OXW_BASE_URL", "http://app:3210").rstrip("/")
CRON_TOKEN = os.environ.get("OXW_CRON_TOKEN", "").strip()
POLL_MINUTES = max(1, int(os.environ.get("OXW_POLL_MINUTES", "20")))
IDLE_SECONDS = max(1, int(os.environ.get("OXW_WORKER_IDLE_SECONDS", "5")))
MODEL_NAME = os.environ.get("OXW_WHISPER_MODEL", "small").strip() or "small"
DEVICE = os.environ.get("OXW_WHISPER_DEVICE", "auto").strip() or "auto"
COMPUTE = os.environ.get("OXW_WHISPER_COMPUTE", "int8").strip() or "int8"
MEDIA_DIR = Path(os.environ.get("OXW_MEDIA_DIR", "/data/media"))
MAX_MEDIA_MB = max(64, int(os.environ.get("OXW_MAX_MEDIA_MB", "2048")))
# Per-job wall-clock timeout for transcription (default 30 min)
JOB_TIMEOUT_SEC = max(60, int(os.environ.get("OXW_JOB_TIMEOUT_SECONDS", "1800")))

HEARTBEAT_PATH = Path("/tmp/worker.heartbeat")


def _write_heartbeat() -> None:
    """Write heartbeat file for Docker healthcheck."""
    try:
        HEARTBEAT_PATH.write_text(str(time.time()))
    except Exception:
        pass


AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".flac", ".mp4", ".webm"}

_model = None
_shutdown = False
_current_job_id: str | None = None
_executor: ThreadPoolExecutor | None = None
_poll_thread: threading.Thread | None = None


def log(message: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{stamp}] {message}", flush=True)


def request(path: str, method: str = "GET", body: dict | None = None) -> dict:
    url = f"{BASE_URL}{path}"
    data = None
    headers = {"accept": "application/json"}
    if CRON_TOKEN:
        headers["x-cron-token"] = CRON_TOKEN
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["content-type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=180) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload) if payload else {}


def safe_stem(doc_id: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9_-]", "", doc_id)[:64]
    return token or "episode"


def download_direct(url: str, target: Path) -> None:
    req = urllib.request.Request(
        url,
        headers={
            "user-agent": "Mozilla/5.0 (compatible; 0xwise-worker/1.0)",
            "accept": "audio/*,video/*,*/*",
        },
    )
    limit = MAX_MEDIA_MB * 1024 * 1024
    written = 0
    with urllib.request.urlopen(req, timeout=120) as response, target.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 512)
            if not chunk:
                break
            written += len(chunk)
            if written > limit:
                raise RuntimeError(f"Audio is larger than OXW_MAX_MEDIA_MB ({MAX_MEDIA_MB} MB)")
            handle.write(chunk)


def download_youtube(url: str, stem: Path) -> Path:
    import yt_dlp  # Imported lazily so direct audio works even if yt-dlp is absent.

    class Quiet:
        def debug(self, _message):
            pass

        def info(self, _message):
            pass

        def warning(self, _message):
            pass

        def error(self, message):
            log(f"yt-dlp: {message}")

    options = {
        "outtmpl": f"{stem}.%(ext)s",
        "format": "bestaudio/best",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "max_filesize": MAX_MEDIA_MB * 1024 * 1024,
        "logger": Quiet(),
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([url])
    produced = sorted(
        [item for item in stem.parent.glob(f"{stem.name}.*") if item.is_file()],
        key=lambda item: item.stat().st_size,
    )
    if not produced:
        raise RuntimeError("yt-dlp finished but produced no audio file")
    return produced[-1]


def resolve_audio(job: dict, doc: dict) -> tuple[Path, str | None]:
    """Return a local audio path plus the filename to report to the app."""
    doc_id = str(doc.get("id") or job.get("payload", {}).get("docId") or "episode")
    audio_url = (doc.get("audioUrl") or "").strip()

    if not audio_url:
        raise RuntimeError("This episode has no audio URL. Add one from an RSS feed or upload audio first.")

    if audio_url.startswith("/api/media/"):
        name = urllib.parse.unquote(audio_url.rsplit("/", 1)[-1])
        path = MEDIA_DIR / name
        if not path.exists():
            raise RuntimeError(f"Audio file is missing on disk: {name}")
        return path, None

    media_dir = MEDIA_DIR
    media_dir.mkdir(parents=True, exist_ok=True)
    stem = media_dir / safe_stem(doc_id)
    existing = [item for item in media_dir.glob(f"{stem.name}.*") if item.is_file()]
    if existing:
        return existing[0], existing[0].name

    log(f"Downloading {audio_url}")
    is_youtube = bool(re.search(r"(youtube\.com|youtu\.be)", urllib.parse.urlparse(audio_url).netloc))
    if is_youtube:
        produced = download_youtube(audio_url, stem)
    else:
        ext = Path(urllib.parse.urlparse(audio_url).path).suffix.lower()
        if ext not in AUDIO_EXTS:
            ext = ".mp3"
        produced = stem.with_suffix(ext)
        download_direct(audio_url, produced)

    if not produced.exists() or produced.stat().st_size == 0:
        raise RuntimeError("Downloaded audio file is empty")
    return produced, produced.name


def load_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        log(f"Loading faster-whisper model '{MODEL_NAME}' (device={DEVICE}, compute={COMPUTE})")
        _model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE)
    return _model


def transcribe(path: Path) -> tuple[list[dict], str, float]:
    model = load_model()
    segments, info = model.transcribe(
        str(path),
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 600},
    )
    collected: list[dict] = []
    for segment in segments:
        text = (segment.text or "").strip()
        if not text:
            continue
        collected.append(
            {
                "start": round(float(segment.start), 2),
                "end": round(float(segment.end), 2),
                "text": text,
            }
        )
    duration = collected[-1]["end"] if collected else float(getattr(info, "duration", 0) or 0)
    lang = getattr(info, "language", "") or ""
    return collected, lang, duration


def _transcribe_with_timeout(job: dict, doc: dict) -> dict:
    """Run transcription with a wall-clock timeout. Returns result dict for the API."""
    path, audio_file = resolve_audio(job, doc)
    log(f"Transcribing {path.name} ({path.stat().st_size / (1024 * 1024):.1f} MB)")
    started = time.time()

    # Run the actual transcription in the executor with timeout
    future = _executor.submit(transcribe, path)
    try:
        transcript, lang, duration = future.result(timeout=JOB_TIMEOUT_SEC)
    except FuturesTimeoutError:
        raise RuntimeError(f"Transcription timed out after {JOB_TIMEOUT_SEC}s")

    if not transcript:
        raise RuntimeError("No speech was detected in this audio")

    log(
        f"Transcribed {len(transcript)} segments in {time.time() - started:.0f}s "
        f"(language={lang or 'auto'})"
    )
    result = {
        "id": job["id"],
        "ok": True,
        "transcript": transcript,
        "durationSec": duration,
        "lang": lang,
    }
    if audio_file:
        result["audioFile"] = audio_file
    return result


def handle_transcribe(job: dict, doc: dict) -> None:
    result = _transcribe_with_timeout(job, doc)
    request("/api/worker/jobs", method="POST", body=result)


def poll_feeds() -> None:
    log("Polling feeds")
    try:
        result = request("/api/cron/poll", method="POST", body={})
        added = sum(int(item.get("result", {}).get("added", 0)) for item in result.get("results", []))
        log(f"Feed poll finished · {added} new document(s)")
    except Exception as error:  # noqa: BLE001 - polling should never kill the worker
        log(f"Feed poll failed: {error}")


def _poll_loop() -> None:
    """Background thread: polls feeds every POLL_MINUTES regardless of in-flight jobs."""
    next_poll = 0.0
    while not _shutdown:
        now = time.time()
        if now >= next_poll:
            poll_feeds()
            next_poll = time.time() + POLL_MINUTES * 60
        _write_heartbeat()
        # Sleep in small increments to check _shutdown promptly
        time.sleep(min(1, IDLE_SECONDS))


def _signal_handler(signum, frame):
    global _shutdown
    if _shutdown:
        log("SIGTERM received again, forcing exit")
        sys.exit(1)
    log("SIGTERM received, finishing current job then exiting")
    _shutdown = True
    # The main loop will notice _shutdown and handle requeue of current job


def _requeue_current_job(job_id: str, error: str) -> None:
    """Report job failure so the app requeues it with backoff (or dead-letters)."""
    try:
        request(
            "/api/worker/jobs",
            method="POST",
            body={"id": job_id, "ok": False, "error": error},
        )
        log(f"Requeued interrupted job {job_id}")
    except Exception as report_error:  # noqa: BLE001
        log(f"Could not report failure for requeue: {report_error}")


def main() -> None:
    global _executor, _poll_thread, _shutdown

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    log(f"0x wise worker starting · app={BASE_URL} · media={MEDIA_DIR} · timeout={JOB_TIMEOUT_SEC}s")
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    # Start background feed polling thread (decoupled from transcription loop)
    _poll_thread = threading.Thread(target=_poll_loop, daemon=True)
    _poll_thread.start()

    # Thread pool for transcription (single worker, so 1 thread is fine)
    _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="transcribe")

    # A container restart can leave a job marked "running" forever. There is a
    # single worker, so anything still running at startup was cut short.
    try:
        recovered = request("/api/worker/jobs?recover=1")
        count = int(recovered.get("recovered") or 0)
        if count:
            log(f"Requeued {count} interrupted job(s)")
    except Exception as error:  # noqa: BLE001 - the loop retries below
        log(f"Could not recover interrupted jobs yet: {error}")

    while not _shutdown:
        _write_heartbeat()
        try:
            response = request("/api/worker/jobs")
        except Exception as error:  # noqa: BLE001 - app may still be booting
            log(f"Cannot reach the app: {error}")
            time.sleep(min(30, IDLE_SECONDS * 2))
            continue

        job = response.get("job")
        if not job:
            time.sleep(IDLE_SECONDS)
            continue

        _current_job_id = job.get("id")
        doc = response.get("doc") or {}
        log(f"Job {_current_job_id} · {job.get('kind')} · {doc.get('title', 'untitled')}")
        try:
            if job.get("kind") == "transcribe":
                handle_transcribe(job, doc)
            else:
                raise RuntimeError(f"Unknown job kind: {job.get('kind')}")
        except Exception as error:  # noqa: BLE001 - report and keep the loop alive
            message = str(error) or error.__class__.__name__
            log(f"Job failed: {message}")
            traceback.print_exc()
            try:
                request(
                    "/api/worker/jobs",
                    method="POST",
                    body={"id": job.get("id"), "ok": False, "error": message},
                )
            except Exception as report_error:  # noqa: BLE001
                log(f"Could not report the failure: {report_error}")
        finally:
            _current_job_id = None

    # Graceful shutdown: if we were interrupted mid-job, requeue it
    if _current_job_id:
        _requeue_current_job(_current_job_id, "Worker shut down (SIGTERM)")

    # Cleanup
    if _executor:
        _executor.shutdown(wait=True)
    log("Worker stopped gracefully")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)