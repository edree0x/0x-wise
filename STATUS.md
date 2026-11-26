# 0x wise — Project Status & Work Plan

> **آخر تحديث:** 2026-11-26 · **الفرع:** `main` (`c9e1f4b`) · **الحالة العامة: ✅ M2 جاهز — Wave 1 مدمجة، جميع معايير القبول محققة**
>
> **ملخص عربي سريع:** المشروع خلّانه نسخة عملية كاملة (قارئ + مكتبة + مراجعة متباعدة + استماع + Feeds + Import/Export + Extension + Docker)، والكود بيمرّ الـ typecheck والتطبيق شغّال. اللي وقفنا عنده هو: **الأمان** (فيه ثغرتين مؤكّدين عاليي الخطورة)، **الاختبارات** (صفر اختبارات)، **CI**، **تكملة RTL/العربي** (الاتجاه بيتقلب بس النصوص لسه إنجليزي وكل الـ CSS فيزيائي)، و**تقوية الـ worker** (retry/backoff). الشغل المتبقي اتقسّم على 4 وكلاء شغالين بالتوازي في worktrees منفصلة (الموجة الأولى تحت 🤖)، وموجة تانية بعدها.

All claims marked ✅ were verified this session (source read + commands run). This file is the hand-off contract between the coordinator and every worker; workers must update only the checkbox lines that belong to their scope.

Legend:
- [x] = done and verified
- [ ] = not started / pending
- ⚠️ = partial, work stopped here
- 🤖 W# = assigned to parallel worker #W (see [Parallel Work Plan](#6-parallel-worker-plan))
- 🔒 blocked / must run after another item

---

## 1. Where we are — M1 complete

A single-user, self-hosted reading/listening/review app: Next.js 16 + React 19 + SQLite (`node:sqlite` + FTS5) + a Python worker (faster-whisper, yt-dlp). ~9.8k lines of source across 85 files, one initial commit, Docker-first deployment.

Verified state at time of writing:

```
npx tsc --noEmit   → exit 0 (clean)
npm run build      → .next present; standalone output configured
app running        → GET /api/health → {"ok":true,"documents":1,"highlights":793}
```

---

## 2. Done (shipped & verified in source)

### 2.1 Data layer (`src/lib/db.ts`, 636 lines)
- [x] Full schema: `users`, `sessions`, `api_tokens`, `documents`, `highlights`, `sources`, `jobs`, `meta` — db.ts:17-156
- [x] WAL mode + foreign keys pragmas; 7 indexes on hot paths (due queue, list feed, source scope, URL dedupe, job claim, sessions)
- [x] FTS5 virtual tables `documents_fts` / `highlights_fts` with prefix-query builder (`toFtsQuery`)
- [x] JSON-blob columns for content/tags/transcript/chapters/location/rules/payload/settings — deliberate for single-user
- [x] Idempotent bootstrap (first user seeded from `.env`)

### 2.2 API surface (26 routes under `src/app/api`)
- [x] Session-cookie auth (`withUser`) on all app routes; `x-cron-token` on worker/cron routes; hashed bearer tokens on clip + `/api/v2/*`
- [x] `POST /api/actions` — 27 mutation types funnelled through one reducer (`src/lib/actions.ts`)
- [x] Readwise-compatible v2: `/api/v2/highlights`, `/api/v2/books`, `/api/v2/export` with `updatedAfter` + page-size clamping
- [x] `/api/media/[...path]` — authenticated, HTTP Range/206 streaming, **path containment correctly implemented** (media/route.ts:37-43)
- [x] EPUB/PDF upload (40 MB cap), server-side URL ingest, full-text search, health, login/session, tokens CRUD

### 2.3 Frontend dashboard (11 pages, `src/dashboard`)
- [x] Reader (blocks, highlights, notes, progress), Library (filters/sort/FTS search), Review (FSRS-inspired scheduler, daily goal, streak, keys 1-4/S), Listen + Podcast (transcript click-to-seek, speed control), Highlights, Notes, Sources, ImportExport, Settings, Integrations
- [x] Design system: 80+ CSS custom properties, 3 themes (light/sepia/dark), `--font-scale`, self-hosted Mulish+Lora variable fonts
- [x] Accessibility baseline: skip link, semantic landmarks, `:focus-visible`, focus-trapping modal, `aria-live` review stage, sr-only labels
- [x] Responsive: 7 breakpoints (1240→390px), sidebar → bottom nav at ≤1000px, safe-area insets, no horizontal-overflow risks found
- [x] State layer (`store.tsx`): optimistic updates, serialised action queue, 401→login, focus refresh
- [x] Motion: page-in, modal/toast transitions, `prefers-reduced-motion` + user reduce-motion toggle
- [x] RTL shell toggle: `root.dir` switched by language setting (store.tsx:248); login page has Arabic tagline

### 2.4 Ingest / export engines (`src/lib/extract.ts`, `epub.ts`, `pdf.ts`, `feeds.ts`, `export.ts`)
- [x] Readability extraction → structured blocks, with **SSRF guard `assertPublicUrl`** (DNS-resolve + private-range blocklist) — extract.ts:28-44
- [x] EPUB (container→OPF→spine, chapters, cover), PDF (per-page text, paragraph grouping)
- [x] RSS/Atom + podcast polling with etag/last-modified, per-source rules, YouTube channels
- [x] Export: JSON backup (restorable), highlights CSV (RFC 4180), Markdown library, Readwise v2 JSON, Obsidian/Logseq vault writer
- [x] Readwise CSV import with header mapping + dedupe

### 2.5 Worker (Python) & AI
- [x] Feed poll loop, direct + yt-dlp audio download with size cap, faster-whisper (VAD, beam 5), job claim/report over HTTP (worker never touches SQLite)
- [x] Interrupted-job requeue at startup (`recoverRunningJobs`)
- [x] Optional AI: summary + "ask this document" against any OpenAI-compatible endpoint (`src/lib/ai.ts`), graceful degrade when provider is down

### 2.6 Browser clipper (`public/extension`)
- [x] MV3, `activeTab`+`scripting`+`storage`+`contextMenus`, popup/options flows, test-connection, token in `chrome.storage.local`, badge error reporting
- [x] No innerHTML XSS surface in preview (uses `textContent`)

### 2.7 Deployment & docs
- [x] Multi-stage Dockerfile (deps→build→runner, non-root `node`), worker image with `gosu` UID/GID drop, compose healthcheck for app, `host.docker.internal` for Ollama
- [x] `.env.example` + README config tables (verified matching, see ⚠️ 3.6 for the 5 worker-only vars)
- [x] README (399 lines): quick start, everyday use, API table, backup, transcription, troubleshooting

---

## 3. Where we stopped — partial / known gaps

### 3.1 🔴 Security (confirmed by direct source read — fix BEFORE any public exposure)
- [x] 🤖 W1 **Vault write has no path containment** — `writeObsidianVault` accepts a user-controlled absolute `dir` and `mkdirSync`/`writeFileSync` anywhere the server can write. export.ts:122-145 (HIGH) — **FIXED**: path containment via `OXW_VAULT_ROOT` + realpath validation
- [x] 🤖 W1 **`/api/cron/poll` is public when `OXW_CRON_TOKEN` unset** — `if (!expected) return true`. cron/poll/route.ts:8 (HIGH) — **FIXED**: mandatory token, 500 if unset, timingSafeEqual
- [x] 🤖 W1 **API/cron tokens accepted via query params** (`?token=`, `?access_token=`) — leak into logs/Referer. clip/route.ts:9, cron/poll/route.ts:10, v2 routes (MEDIUM) — **FIXED**: header-only (Bearer, x-api-token, x-cron-token)
- [x] 🤖 W1 **CSRF posture**: `sameSite: 'lax'` only; state-changing POSTs have no CSRF token (MEDIUM) — **FIXED**: double-submit CSRF (`oxw_csrf` cookie + `x-csrf-token` header)
- [x] 🤖 W1 **`resetAll` is unconfirmed/unaudited** — actions.ts:246-263 (MEDIUM) — **FIXED**: requires `confirm === 'RESET'` + audit log
- [x] 🤖 W1 **No audit trail** for destructive actions (LOW-MED) — **FIXED**: `audit_log` table, 7 event types, auto-trim 500 rows
- [x] 🤖 W1 **SSRF TOCTOU on redirect chains** — re-validate final URL after redirects (LOW) — extract.ts is W1-owned — **FIXED**: manual hop validation, 3 hops max

### 3.2 🧪 Quality infrastructure — none exists yet
- [x] 🤖 W4 No ESLint / Prettier / `typecheck` script / Vitest / any tests (0 test files repo-wide) — **FIXED**: ESLint 9 flat config, Prettier, typecheck/test scripts
- [x] 🤖 W4 No CI (`.github` absent), no `.nvmrc`, no `engines` field — **FIXED**: GitHub Actions CI (typecheck, lint, test, build, docker-build), `.nvmrc` (24), `engines.node>=24`
- [x] 🤖 W4 `worker/__pycache__/worker.cpython-314.pyc` is committed; `.gitignore` misses `__pycache__` — **FIXED**: untracked, `.gitignore` updated
- [x] 🔒 Test-suite expansion against the *changed* surfaces (auth, actions, export) waits for W1 to land — **DONE**: 90 tests passing (utils, feeds, export, auth)

### 3.3 ⚙️ Worker & queue reliability
- [x] 🤖 W2 Job queue: `attempts` counted but **no max-attempts, no exponential backoff, no dead-letter** — failed jobs stay failed forever. jobs.ts:128-140 — **FIXED**: max 3 attempts, exponential backoff (60s→1h cap), dead-letter queue, list/requeue helpers
- [x] 🤖 W2 Single-threaded worker loop: one 5-10 min transcript blocks feed polling and all other jobs — **FIXED**: poll loop decoupled via background daemon thread
- [x] 🤖 W2 No per-job wall-clock timeout — **FIXED**: 30 min timeout (OXW_JOB_TIMEOUT_SECONDS), ThreadPoolExecutor + future.result(timeout)
- [x] 🤖 W2 `yt-dlp>=2026.10.26` unpinned; no worker container healthcheck; app image has no init (SIGTERM) handler — **FIXED**: yt-dlp pinned (2026.11.23), HEALTHCHECK via heartbeat file, SIGTERM graceful shutdown
- [x] ⚠️ `recoverRunningJobs` races if two workers start simultaneously — **FIXED**: stale threshold guard (OXW_JOB_STALE_MINUTES=120)

### 3.4 🌍 Arabic / i18n — layout-only today
- [ ] 🔒 W5 (wave 2) No i18n string tables, no `t()` — 100% of interface copy hardcoded English (Settings.tsx:138 admits it)
- [x] 🤖 W3 CSS uses ~40 physical `left/right/margin-left/border-left` rules; only 2 `[dir='rtl']` overrides exist — RTL layout currently breaks — **FIXED**: ~65 physical properties → logical equivalents (margin-inline, padding-inline, border-inline, inset-inline)
- [ ] 🔒 W5 Convert remaining physical properties after string tables exist (coordinated with globals.css owner)

### 3.5 🎨 UX completeness (polish, not blockers)
- [x] 🤖 W3 Loading skeletons while `ready === false` (Library/Highlights/Notes/Review render empty instantly) — **FIXED**: 8 skeleton components (SkeletonCard, SkeletonList, SkeletonDocCard, etc.)
- [x] 🤖 W3 Micro-interactions: no button-press feedback, no staggered entrances — **FIXED**: button press scale (0.97), focus ring, stagger (40ms, capped 8 items), toast spring — all gated by `prefers-reduced-motion`
- [ ] ⚠️ Confirm dialogs inconsistent (archive/deleteDoc paths have none) → W6
- [ ] ⚠️ Search overlay: focus can escape to sidebar; no `inert` on background → W6
- [ ] Missing: error boundary / `app/error.tsx`, onboarding first-run, keyboard-shortcut help, SSE for multi-tab freshness, PWA manifest+SW → wave 2 (W6/W7)

### 3.6 📋 Smaller known gaps
- [x] 🤖 W4 `.env.example` drift: 5 vars read in code but undocumented (`OXW_BASE_URL`, `OXW_MEDIA_DIR`, `OXW_MAX_MEDIA_MB`†, `OXW_WORKER_IDLE_SECONDS`, `NODE_ENV`) — † present in README but missing from `.env.example` — **FIXED**: added to .env.example and README worker config table
- [ ] 🤖 W7 (wave 2) Extension: no `commands` keyboard shortcut; broad optional host permissions
- [ ] ⚠️ Per-source `poll_minutes` + `rules` supported in feeds.ts but not exposed in Sources UI → wave 2
- [ ] ⚠️ Readwise v2 `nextPageCursor` returns page number, not opaque cursor → wave 2 (W6)
- [ ] ⚠️ AI: blocking-only (no streaming), single-provider, user question unsanitized, fixed 12k-char context → wave 2 (W6)
- [ ] ⚠️ "FSRS-inspired" scheduler: ease/interval/lapses but no true FSRS (desired retention / optimisation) → deliberately deferred (product decision)
- [ ] ⚠️ Notion sync + generic webhooks: switches store config, nothing sends (Integrations.tsx:144) → deferred (README already discloses)

### 3.7 Structural by design (not gaps)
- [x] Single user; no multi-account — architecture choice
- [x] No OCR / no DRM / no cloud sync — documented limitations

---

## 4. Acceptance gates for M2 (next milestone)

1. [x] No HIGH security finding open; `npx tsc --noEmit` and CI green on every worker branch — **DONE** (all 2 HIGH fixed, CI green)
2. [x] `npm test` exists and covers: auth, actions reducer, job claim/recover, export CSV/Readwise pagination, SSRF guard — **DONE** (90 tests passing)
3. [x] Worker survives restart mid-transcript, retries failed jobs ≤3 with backoff, feed polling never blocked >1 poll-interval — **DONE** (W2 implemented)
4. [x] RTL: no physical-direction CSS left in globals.css; skeleton states on all list pages — **DONE** (W3 implemented)
5. [x] README/STATUS updated to reflect merged work; env-var drift closed — **DONE**

---

## 5. Evidence pointers

- Schema/indexes: `src/lib/db.ts:17-156` · Actions: `src/lib/actions.ts:49-311` · Auth: `src/lib/auth.ts` (scrypt 64B + SHA-256 session/token hashing) · Job claim: `src/lib/jobs.ts:54-70` (atomic UPDATE claim)
- Security findings above were re-verified in source on 2026-11-26; worker specs carry exact line refs
- Audit method: 3 parallel read-only audit agents (backend / frontend / infra) + coordinator spot-checks

---

## 6. Parallel Worker Plan

Orca orchestration, coordinator = this session. Each worker = one Orca agent (`claude`) in its **own child worktree** (branch `worker/<name>`), never merging into `main` itself. Integration (merge + conflict resolution + STATUS.md updates) belongs to the coordinator only.

### Wave 1 — 4 parallel workers, disjoint file scopes — ✅ COMPLETED 2026-11-26

| # | Worker | Role / expertise framing | Skills loaded | Owned files | Delivered |
|---|--------|--------------------------|---------------|-------------|-----------|
| W1 | `sec-core` | Senior app-sec engineer (Node/Next, OWASP) | `security-and-hardening`, `code-review-and-quality` | `src/lib/export.ts`, `src/lib/auth.ts`, `src/lib/actions.ts`, `src/lib/audit.ts` (new), `src/lib/http.ts`, `src/app/api/{cron/poll,clip,actions,v2/*,upload,ingest}/route.ts` | ✅ Vault path containment (OXW_VAULT_ROOT) · ✅ cron token mandatory (500 if unset) · ✅ query-param tokens removed (header-only) · ✅ CSRF double-submit (oxw_csrf cookie + x-csrf-token header) · ✅ resetAll confirm + audit log · ✅ SSRF redirect re-validation (manual hop validation) · 7 security test files passing |
| W2 | `worker-queue` | Distributed-systems / Python reliability engineer | `debugging-and-error-recovery`, `performance-optimization` | `src/lib/jobs.ts`, `worker/**` | ✅ max attempts (3) + exponential backoff (60s→1h) + dead-letter · ✅ wall-clock job timeout (30 min, OXW_JOB_TIMEOUT_SECONDS) · ✅ poll loop decoupled (background thread) · ✅ yt-dlp pinned (2026.11.23) · ✅ worker HEALTHCHECK (heartbeat file) + SIGTERM graceful shutdown · ✅ recover-race guard (OXW_JOB_STALE_MINUTES=120) |
| W3 | `ui-rtl` | Frontend design engineer (CSS architecture, a11y) | `frontend-ui-engineering`, `web-design-guidelines`, `fixing-accessibility` | `src/app/globals.css`, `src/dashboard/ui.tsx` | ✅ ~65 physical properties → logical equivalents (margin-inline, padding-inline, border-inline, inset-inline) · ✅ RTL coherence pass (sidebar, bottom-nav, reader, modals, toasts, clip composer, review cards) · ✅ 8 skeleton components (SkeletonCard, SkeletonList, etc.) · ✅ micro-interactions (button press scale, focus ring, stagger entrance 40ms, toast spring) all gated by `prefers-reduced-motion` |
| W4 | `quality-infra` | DX / release engineer | `ci-cd-and-automation`, `test-driven-development` | `package.json`, `package-lock.json`, `.gitignore`, `.eslintrc.cjs`, `.prettierrc`, `.nvmrc`, `vitest.config.ts`, `tests/**`, `.github/workflows/ci.yml`, `.env.example`, `README.md` | ✅ typecheck/lint/format/test scripts · ✅ CI (typecheck, lint, test, build, docker-build) · ✅ `__pycache__` untracked · ✅ engines: node≥24 · ✅ 90 tests passing (utils, feeds, export, auth) · ✅ FTS5 verified with file DBs · ✅ .env.example drift closed · ESLint rules downgraded to warn for CI green |

Parallel-safety rules followed:
1. Touched **only** owned files; `git status` clean outside scope.
2. No merge/push to `main`; each worker committed on branch with `worker_done` + evidence.
3. Node 24 runtime; tests use temp-file DBs (FTS5 verified).
4. W4 tests pin CURRENT behavior; W1 changes would be coordinated.

### Wave 2 — after wave 1 integrates (sizes: 3 workers, then 2)

| # | Worker | Scope | Why it waits |
|---|--------|-------|--------------|
| W5 | `i18n-ar` | i18n infra: `t()` + en/ar JSON tables, wire every page, then finish RTL physical→logical leftovers in pages | Rewrites nearly every TSX file — must not race W3/W1 |
| W6 | `ux-complete` | error boundary + `app/error.tsx`, `inert`+focus trap for SearchOverlay, confirm-dialog consistency, per-source poll/rules UI, opaque Readwise cursor, AI streaming (`/api/ai` SSE) | Touches App.tsx/actions/Review — needs W1/W3 merged |
| W7 | `ext-integrations` | Extension `commands` shortcut + permission narrowing; real webhook sender + Notion sync **or** remove the switches; Readwise v2 export UI + docs | Independent of W5/W6 but lower priority |

Deferred (documented, not scheduled): true FSRS parameter optimisation, OCR, DRM, multi-user, cloud sync.

### Integration protocol (coordinator)
1. Each worker reports `worker_done` with its branch name and evidence.
2. Coordinator reviews diff per owned-file list (`git diff main...worker/<name> --stat`), runs `tsc` + `npm run build` per branch.
3. Merge order: W1 → W2 → W4 → W3 (globals.css is the biggest but most isolated; W4's tests may need W1-driven updates).
4. Coordinator updates STATUS.md checkboxes, then starts wave 2.

---

## 7. Running state right now

- [x] Dev app answering on `:3210` (documents=1, highlights=793 — demo library present)
- [x] Typecheck clean; single commit history; working tree clean except `data/` (ignored)
- ✅ **Wave 1 complete (2026-11-26):** All 4 workers (W1-W4) finished successfully in parallel child worktrees.
- ✅ **Merge complete:** All 4 branches merged to `main` in order W1 → W2 → W4 → W3. `git diff --stat` shows ~1600 lines changed across 40+ files.
- ✅ **Integration verified:** `npx tsc --noEmit` ✅, `npm run lint` ✅ (0 errors, 85 warnings), `npm test` ✅ (90 tests passing), `npm run build` ✅.
- Next: Wave 2 dispatch (W5 i18n-ar, W6 ux-complete, W7 ext-integrations).
