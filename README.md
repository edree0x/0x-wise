# 0x wise

A self-hosted reading library, reader, listen queue and spaced-review space for
everything you want to remember. It replaces the parts of Readwise, Readwise
Reader and Podwise that matter day to day, and keeps every byte on your own
machine.

Everything is one user, one SQLite file, one folder of media. There is no
account server, no telemetry and no vendor in the loop.

## What it does

- **Reader** — save articles, newsletters, tweets, EPUB books and PDFs. Read
  them in a clean, themeable view with highlights, notes, tags and reading
  progress.
- **Library** — filter by kind, search full text (SQLite FTS5), favourite,
  archive and sort by recency, length or progress.
- **Review** — a FSRS-inspired scheduler brings highlights back at widening
  intervals (Again / Hard / Good / Easy), with a daily goal, streak and
  keyboard shortcuts (`1`–`4`, `S`).
- **Listen** — podcast and YouTube episodes with a transcript pane that seeks
  the audio when you click a line, plus speed control.
- **Sources** — add RSS and podcast feeds from the UI; a background worker
  polls them and imports new items.
- **Import & export** — paste, fetch a URL, upload EPUB/PDF, restore a JSON
  backup, import a Readwise CSV; export JSON, highlights CSV, Markdown,
  Readwise v2 JSON and an Obsidian/Logseq vault.
- **Browser clipper** — a Chromium extension sends a selection or a page
  straight into the library with a per-device API token.
- **Local transcription** — episodes are transcribed on this machine with
  faster-whisper. No audio leaves the host.
- **Optional AI** — summaries and "ask this document" against Ollama or any
  OpenAI-compatible endpoint.
- **Readwise-compatible API** — `/api/v2/highlights` and `/api/v2/books` with a
  bearer token, so existing Readwise plugins can read your library.
- **Arabic / RTL** — the interface can switch to a right-to-left layout. Most
  copy is still English; see [Limitations](#limitations).

## Quick start (Docker)

Requirements: Docker with Compose v2, about 3 GB of disk for the images plus
room for books, audio and the Whisper model.

```bash
cp .env.example .env
# edit OXW_PASSWORD and OXW_CRON_TOKEN at minimum
docker compose up -d --build
```

Open <http://localhost:3210> and sign in with the credentials in `.env`:

```
email:    me@0xwise.local
password: 0xwise
```

The stack has two containers:

| Service  | What it does                                                        |
| -------- | ------------------------------------------------------------------- |
| `app`    | Next.js server on port 3210, SQLite, media streaming                 |
| `worker` | Polls feeds, downloads episode audio, transcribes it with Whisper    |

The worker waits for the app health check, then starts polling. The first
transcription downloads a Whisper model into `./models` (see
[Transcription](#transcription)).

### Reaching it from other devices

The app listens on `0.0.0.0` inside the container and is published on
`OXW_PORT` (default `3210`). On a phone or another laptop use
`http://<this-machine-ip>:3210`.

`OXW_INSECURE=1` is the default so the session cookie is accepted over plain
HTTP on a LAN address. If you put 0x wise behind an HTTPS reverse proxy, set
`OXW_INSECURE=0` so cookies are marked `Secure`.

### Logs and lifecycle

```bash
docker compose logs -f app
docker compose logs -f worker
docker compose restart worker
docker compose down            # keeps ./data and ./models
docker compose up -d --build   # rebuild after pulling changes
```

## Configuration

All settings live in `.env` (Compose reads it automatically).

### App

| Variable         | Default               | Notes                                            |
| ---------------- | --------------------- | ------------------------------------------------ |
| `OXW_PORT`       | `3210`                | Host port for the web app                        |
| `OXW_EMAIL`      | `me@0xwise.local`     | Sign-in address, used when the database is first created |
| `OXW_PASSWORD`   | `0xwise`              | Sign-in password                                 |
| `OXW_INSECURE`   | `1`                   | `1` allows the session cookie over HTTP          |
| `OXW_CRON_TOKEN` | `change-me-too`       | Shared secret for the worker and `/api/cron/poll` |
| `OXW_DATA_DIR`   | `/data` in Docker     | SQLite, media and exports                        |
| `OXW_UID` / `OXW_GID` | `1000`           | Owner of the bind-mounted folders                |

The email and password are only read when the user row does not exist yet.
Changing `OXW_PASSWORD` later does not change an existing login; use the
database reset described in [Backup and restore](#backup-and-restore) or edit
the password from a fresh data folder.

### AI (optional)

| Variable           | Default                     | Notes                                  |
| ------------------ | --------------------------- | -------------------------------------- |
| `OXW_AI_PROVIDER`  | `ollama`                    | Label only; the URL/model do the work  |
| `OXW_AI_BASE_URL`  | `http://host.docker.internal:11434/v1` in Docker | Any OpenAI-compatible base URL |
| `OXW_AI_MODEL`     | `llama3.1:8b`               | Model name as the provider knows it    |
| `OXW_AI_API_KEY`   | empty                       | Bearer token for cloud providers       |

For Ollama on the host, the Compose default works because the app container has
a `host.docker.internal` entry. Outside Docker use
`http://localhost:11434/v1`. For a cloud provider point the base URL at it
(for example `https://api.openai.com/v1`) and set the key and model.

The UI degrades cleanly when no provider is reachable: summarise/ask returns the
provider error instead of blocking the reader.

### Worker

| Variable                  | Default | Notes                                              |
| ------------------------- | ------- | -------------------------------------------------- |
| `OXW_POLL_MINUTES`        | `20`    | How often feeds are polled                         |
| `OXW_WHISPER_MODEL`       | `small` | Model name (`tiny`, `base`, `small`, `medium`, `large-v3`) or a local folder path |
| `OXW_WHISPER_DEVICE`      | `auto`  | `cpu`, `cuda` or `auto`                            |
| `OXW_WHISPER_COMPUTE`     | `int8`  | `int8`, `int8_float16`, `float16`, `float32`       |
| `OXW_MAX_MEDIA_MB`        | `2048`  | Refuse to download episodes larger than this       |
| `OXW_WORKER_IDLE_SECONDS` | `5`     | Queue polling interval                             |

## Everyday use

### Add something to read

- **Reader → Add → Paste text / From a link / EPUB / PDF.**
- A link is fetched server-side, the readable article is extracted and stored
  as blocks. Pages that block scrapers fall back to a bookmark with the
  original URL.
- EPUB and PDF are parsed locally: chapters for books, page text for PDFs.
- The browser clipper can add a page or a selection without switching tabs.

### Add feeds

**Sources → Add source.** Paste an RSS or Atom URL; use the podcast kind for
shows with audio enclosures. Add a bare YouTube channel or video URL to get
episodes. The worker polls every `OXW_POLL_MINUTES` and imports new items;
**Sources → Poll now** does it on demand.

### Read and highlight

Open a document, select text and choose a colour. Highlights carry an optional
note and tags. Podcast transcript lines can be highlighted the same way, with
the timestamp stored as the location.

### Review

Review shows what is due. Rate with the buttons or keys `1`–`4`; `S` skips.
Intervals widen with each successful review and reset on **Again**. The daily
goal and streak are on the review page and the sidebar.

### Listen

Episodes from a podcast or YouTube source appear under **Listen**. The episode
page has the player and the transcript. Click a transcript line to seek; the
speed control changes playback rate. Transcripts come from the worker, which
runs entirely on this machine.

To transcribe an episode, open its page and choose **Transcribe** (or enqueue
it from the Listen card). Progress shows in the UI; a failed job shows the
error and leaves the audio playable.

### Clip from the browser

1. In **Integrations → API**, create a token and copy it once.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**
   and select `public/extension` from a source checkout. With Docker only, copy
   it out first:
   ```bash
   docker compose cp app:/app/public/extension ./extension
   ```
3. Open the extension options, enter `http://localhost:3210` (or your LAN
   address), paste the token, save and test.
4. Select text on a page and use **Clip selection**, or right-click and choose
   **Clip page to 0x wise**.

The extension reads only the title, URL and selection of the active page, and
talks only to the address you configure. Revoke a token in Integrations to
disable a device.

### Import, export and backup

**Import & export** covers:

| Format            | Direction | Notes                                            |
| ----------------- | --------- | ------------------------------------------------ |
| Pasted text       | in        | Title, author, source, category, tags            |
| Link              | in        | Server-side fetch + readability extraction       |
| EPUB / PDF        | in        | 40 MB limit per file                             |
| JSON backup       | both      | Everything, restorable                           |
| Readwise CSV      | in        | The CSV export from Readwise                     |
| Highlights CSV    | out       | Spreadsheet-friendly                             |
| Markdown library  | out       | Quotes, notes and tags                           |
| Readwise v2 JSON  | out       | Import into another reader                       |
| Obsidian / Logseq | out       | Writes one markdown file per book/article        |

The Obsidian/Logseq exporter writes to a folder **inside the container**. To
write into a real vault, mount it in `docker-compose.yml`:

```yaml
    volumes:
      - ./data:/data
      - /home/you/Vault:/vault
```

then set the target folder to `/vault/Reading` in Integrations.

## Backup and restore

The canonical copy of everything is the data folder:

```
data/
  0xwise.db        SQLite database (WAL mode)
  0xwise.db-wal
  media/           downloaded audio, covers and uploads
  export/          vault exports
models/            Whisper model cache
```

Stop the stack before copying the database so the WAL is flushed:

```bash
docker compose down
cp -a data data-$(date +%F)
docker compose up -d
```

Restore by putting the folder back. For a portable, app-level copy use
**Import & export → JSON backup** and **Restore backup**; it round-trips the
library, highlights and settings without touching SQLite files.

To start over, stop the stack, move `data` aside and start again; the schema and
first user are recreated from `.env`.

## Transcription

The worker uses [faster-whisper](https://github.com/SYSTRAN/faster-whisper) on
CPU by default. The first transcription downloads the chosen model from
Hugging Face into the `models` folder:

This install already has `models/small` downloaded and checksum-verified, and
`.env` sets `OXW_WHISPER_MODEL=/models/small`, so transcription works offline
from the first run. `models/tiny` is kept as a fast fallback for tests.

| Model      | Download | Rough speed on a modern 12-core CPU | Good for                  |
| ---------- | -------- | ----------------------------------- | ------------------------- |
| `tiny`     | ~75 MB   | very fast                           | smoke tests, quick notes  |
| `base`     | ~145 MB  | fast                                | short clips               |
| `small`    | ~480 MB  | ~5–10× realtime                     | podcasts (default)        |
| `medium`   | ~1.5 GB  | ~2–4× realtime                      | noisy audio, accents      |
| `large-v3` | ~3 GB    | slower, needs RAM                   | best quality              |

Model downloads are the one part that needs the network. On a slow connection,
download the model on a faster machine and copy the folder into `./models`,
then point the worker at it:

```bash
# ./models/my-model/{config.json,model.bin,tokenizer.json,vocabulary.txt}
OXW_WHISPER_MODEL=/models/my-model docker compose up -d worker
```

Set `OXW_WHISPER_DEVICE=cuda` and `OXW_WHISPER_COMPUTE=float16` with an NVIDIA
GPU and the NVIDIA container toolkit if you want it faster. The current worker
image is CPU-only; switch the base image and add the GPU device in Compose if
you need CUDA.

Audio is downloaded to `data/media`. Direct audio URLs are fetched with a size
cap; YouTube and similar pages go through `yt-dlp`. Downloads can fail when a
site changes or an episode is region-locked — update `yt-dlp` and rebuild the
worker image to pick up fixes.

The worker never touches SQLite. It claims jobs and reports results through
`/api/worker/jobs`, authenticated with `OXW_CRON_TOKEN`, and calls
`/api/cron/poll` for feeds. If it restarts mid-job, the interrupted job is put
back in the queue at startup.

## API

All app endpoints require the session cookie, except where noted.

| Endpoint                    | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `GET /api/health`           | Liveness + counts (public)                      |
| `POST /api/auth/login`      | Email + password, sets the session cookie       |
| `GET /api/state`            | Full application state                          |
| `POST /api/actions`         | Every mutation, `{ type, payload }`             |
| `POST /api/clip`            | Extension clip, bearer token                    |
| `POST /api/ingest`          | Fetch a URL server-side                         |
| `POST /api/upload`          | EPUB/PDF multipart upload                       |
| `GET /api/export?format=…`  | `json`, `backup`, `csv`, `markdown`, `readwise`, `obsidian`, `logseq` |
| `GET /api/search?q=…`       | Full-text search                                |
| `GET /api/v2/highlights`    | Readwise-compatible highlights, bearer token    |
| `GET /api/v2/books`         | Readwise-compatible books, bearer token         |
| `GET /api/v2/export`        | Readwise-compatible bulk export, bearer token   |
| `GET /api/media/…`          | Authenticated media with HTTP Range support     |
| `GET /api/worker/jobs`      | Worker claims a job, `x-cron-token`             |
| `POST /api/worker/jobs`     | Worker reports a result, `x-cron-token`         |
| `POST /api/cron/poll`       | Poll every source, `x-cron-token`               |
| `POST /api/ai`              | Summarise or ask about a document               |

Example:

```bash
curl -H "authorization: Bearer oxw_…" \
  "http://localhost:3210/api/v2/highlights?page_size=50"
```

## Development without Docker

Node 24+ is required because the app uses the built-in `node:sqlite`
(`DatabaseSync`) with FTS5.

```bash
npm ci
cp .env.example .env
npm run dev                       # http://localhost:3210

# in a second shell, for feeds and transcription
python3 -m venv .venv
. .venv/bin/activate
pip install -r worker/requirements.txt
OXW_BASE_URL=http://localhost:3210 OXW_DATA_DIR=./data \
  OXW_WHISPER_MODEL=tiny python3 worker/worker.py
```

`npm run build && npm start` also works for a production-style run, though the
project is configured with `output: 'standalone'`, so the Docker image is the
intended production path.

The extension is plain files in `public/extension`; reload it from
`chrome://extensions` after editing.

## Security notes

This is a single-user app meant for a trusted network.

- Change `OXW_PASSWORD` and `OXW_CRON_TOKEN` before exposing it to anything.
- Prefer a VPN or an HTTPS reverse proxy with `OXW_INSECURE=0` over publishing
  port 3210 directly to the internet.
- API tokens are stored hashed and can be revoked in Integrations.
- The worker token grants queue access, so treat it like a password.
- Media files and exports are served only to an authenticated session.

## Limitations

- **One user.** There is no multi-account or sharing model.
- **Arabic is layout-only for now.** The toggle switches `lang`/`dir` and the
  shell to RTL, but most interface copy is still English. Article and highlight
  text in Arabic renders correctly.
- **Notion and generic webhooks are placeholders.** Their switches store a
  configuration; nothing is sent yet. Obsidian/Logseq export, Readwise CSV
  import and the Readwise-compatible API are real.
- **No OCR.** Scanned PDFs without a text layer import as empty documents.
- **DRM-protected EPUB/PDF is not supported.**
- **No cloud sync.** Back up the data folder or use the JSON export.
- **YouTube imports depend on `yt-dlp`.** Expect to rebuild the worker image
  when the site changes.
- **Readwise import is CSV-based**, not a live Readwise API sync.

## Troubleshooting

**Login bounces back.** Over plain HTTP on a LAN address, keep
`OXW_INSECURE=1`; otherwise the browser refuses the `Secure` session cookie.

**The worker says "Cannot reach the app".** It waits for the app health check
on startup, then retries. Check `docker compose logs app` and that both
containers share the Compose network.

**Transcription sits at `transcribing`.** The model is still downloading, or the
job was interrupted. `docker compose restart worker` requeues interrupted jobs;
watch `docker compose logs -f worker`.

**Feeds never update.** Check the source URL in a browser, then
**Sources → Poll now**. Some feeds block unknown user agents.

**Audio will not seek.** Media is served with Range support, but the request
must carry the session cookie. Opening `/api/media/...` in a private window
returns 401 by design.

**Disk fills up.** Episodes are kept in `data/media` after transcription. Use
the Listen page to remove episodes you no longer need, or clear the folder and
keep the database.
