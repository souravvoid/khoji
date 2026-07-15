# Khoji — Privacy and Safety

Khoji is an **offline-first AI knowledge workspace**. This document explains,
honestly and plainly, what happens to your data, what leaves your machine, and
the known limitations of the current build.

## Privacy model

Khoji is designed so that **all user content stays on your own computer**.

- **No telemetry.** The application does not collect usage statistics, crash
  reports, or any other analytics. There is no analytics SDK and no phone-home
  code path.
- **No cloud API.** Every AI capability — OCR, embeddings, vector search,
  summarisation, chat, quiz and flashcard generation — runs locally. There is
  no server that Khoji sends your documents or prompts to.
- **No network egress during normal operation.** Once models are present on
  disk, the app makes zero outbound network connections in the course of
  ingesting, searching, or chatting with your documents.
- **Single-user desktop app.** There is no account, no login, and no
  multi-tenant boundary to defend.

## Where your data lives

All persistent state is written under a single directory:

```
~/.khoji/
  khoji.db      SQLite database (documents, chunks, notes, flashcards, quizzes, chat)
  vectors/      FAISS index (binary) + chunk metadata (JSON)
  models/       GGUF model files (local LLM weights)
```

The SQLite database is opened at `~/.khoji/khoji.db` with WAL mode enabled and
`foreign_keys = ON` (`backend/python/khoji_engine/database/db.py`). Deleting
this directory removes all of Khoji's data.

The embedding model (`all-MiniLM-L6-v2`) is cached by sentence-transformers
under the standard HuggingFace cache, `~/.cache/huggingface/`, on first use
(see `backend/python/khoji_engine/ai/embeddings.py`).

## What leaves the device

**Only one thing, and only sometimes:** a one-time model download.

- The embedding model is fetched automatically from `huggingface.co` the first
  time it is needed, if it is not already cached.
- The local LLM GGUF files are downloaded via `urllib.request` from
  `huggingface.co` the first time a given model is requested, if not already
  present in `~/.khoji/models` (`backend/python/khoji_engine/ai/llm.py`).

Both downloads are **optional** and **one-time**:

- They use HTTPS and validate TLS certificates by default.
- They only happen when the model is not already on disk.
- For offline demos and air-gapped environments, the models can be pre-staged
  (see `LOCAL_AI_VERIFICATION.md`). After pre-staging, no network access is
  required at all.
- **No document text, no prompts, no queries, and no user data are ever
  transmitted during these downloads.** Only the model weight files are
  retrieved.

## Security posture

Khoji's local-only architecture removes entire classes of network attack
surface. The specific, code-level guarantees are:

- **Parameterized SQL.** Every database query uses `?` placeholders — there is
  no string concatenation of user input into SQL
  (`backend/python/khoji_engine/database/db.py`). This prevents SQL injection.
- **Safe subprocess spawn.** The Python engine is launched as a separate
  process. Document parsing never passes user input to a shell; the only
  external process spawned with document input is the **Tesseract CLI**, called
  with an argument list (no shell, no shell interpolation)
  (`backend/python/khoji_engine/pipeline/ocr.py`). There is no `eval()`,
  `exec()`, or shell-invoking call with user input.
- **LLM output is text only.** Model responses are treated as display text and
  are never executed as code or as commands. The LLM has no filesystem or
  network access of its own.
- **Minimal Tauri capabilities.** The desktop shell grants only
  `core:default` and `dialog:default`. The frontend cannot directly access the
  filesystem, network, shell, or path APIs (`docs/internal/SECURITY_REVIEW.md`).
- **File-path validation.** `process_document` canonicalizes paths with
  `Path.resolve()` and enforces an extension whitelist (PDF, DOCX, PPTX, EPUB,
  PNG, JPG, JPEG), preventing path-traversal via `../` sequences.

### Known hardening gap: Content Security Policy is disabled

In the current `tauri.conf.json`, the Content Security Policy is set to
`"csp": null` — **disabled**. This means the WebView places no restriction on
script/style/image sources.

This is a **known gap**, acknowledged for the hackathon build. The recommended
remediation (already noted in `docs/internal/SECURITY_REVIEW.md`) is to enable a
restrictive policy such as:

```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
```

We disclose this openly rather than hiding it: for a single-user local desktop
app the practical risk is low (there is no remote content being loaded and no
untrusted web origin), but it should be enabled before any production release,
and LLM output should additionally be stripped of HTML/script tags before
rendering.

### Other limitations (disclosed)

- **No encryption at rest.** `khoji.db` and the vector index are stored as
  plaintext. Any user or process that can read `~/.khoji/` can read your data.
  For sensitive material, use filesystem-level encryption (LUKS, eCryptfs, or
  your OS equivalent).
- **No sandboxing.** The Python engine runs with the user's full permissions.
- **Input validation is partial.** Only `process_document` validates paths;
  other IPC commands operate on `doc_id` strings.
- **Malicious documents (residual risk).** Parsing libraries (PyMuPDF,
  python-docx, python-pptx, EbookLib) are mature and do not execute embedded
  scripts, but they remain exposed to parser zero-days like any document tool.

## Prompt-injection note

Because the LLM runs **locally** and is fed **only your local documents**, the
prompt-injection risk is low and bounded:

- The model can be tricked by hostile text inside an imported document (e.g.
  "ignore previous instructions…"), but its output is **displayed as text
  only** — it cannot take actions, access the filesystem, call tools, or reach
  the network.
- The worst realistic outcome is a misleading or off-topic answer, not data
  exfiltration or system compromise.

## Crash recovery limitations

Khoji runs a **single Python engine subprocess** that the Rust/Tauri shell
launches. There is **no automatic restart supervisor**: if that engine process
crashes, the UI will report errors until the app is restarted. This is a known
operational limitation; for a hackathon demo it is acceptable, but a production
build should add process health-checking and auto-respawn.

## Bottom line for reviewers

Khoji does what it claims: it is a genuinely local application whose entire
feature set runs on your hardware. The only network touch is an optional,
one-time, HTTPS model download that can be eliminated entirely by pre-staging
models. We have stated our weaknesses plainly — disabled CSP, no at-rest
encryption, no engine auto-restart — so they can be verified, not discovered.
