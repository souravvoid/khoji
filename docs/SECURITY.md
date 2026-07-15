# Security Report — Khoji Final QA

Khoji is fully offline: the engine runs as a **local subprocess**, all data stays
on disk under `~/.khoji`, and there is no network egress in the documented flows
(model downloads are opt-in, user-initiated). The following were verified.

## File access (path traversal) — PASS
`frontend/src-tauri/src/lib.rs::validate_file_path()` resolves the requested
path and **rejects anything outside the user's home directory** before it is
handed to the engine. A crafted path like `/etc/passwd` or `../../secrets`
cannot be ingested. No traversal to system files was possible in testing.

## Output rendering (XSS / injection) — PASS
Search results and chat answers are React-rendered strings; the component
(`SearchResultItem`) escapes content. There is **no `dangerouslySetInnerHTML`**
in the source, so a document containing `<script>` or `<img onerror>` cannot
execute. Markdown/HTML exports are static files written to disk, not injected
into the live DOM.

## Secrets / credentials — PASS
- `grep -ri "api[_-]?key|secret|token|password|sk-"` over source found **no
  embedded secrets or cloud endpoints**.
- `npm audit` (frontend) — **0 vulnerabilities**.
- `.gitignore` already excludes `.venv/`, `__pycache__/`, build artifacts and
  caches, so a `git add .` cannot leak the model cache or venv.

## Injection into the engine — PASS
The IPC channel is **JSON over stdin/stdout**; the engine parses each line with
`json.loads` and dispatches via a fixed `ACTION_HANDLERS` table. There is **no
`eval`/`exec`/`__import__` from payload data** — a malicious `payload` field
cannot execute code. Invalid actions return `"error":"unknown action"`.

## Temp files — PASS
Extracted images and intermediate files are written under the OS temp dir and
cleaned up; the engine does not leave readable copies of document contents
outside `~/.khoji`.

## Notes / non-issues
- GGUF model downloads (`download_model`) fetch from a configurable URL; if a
  teammate points it at an untrusted host they should verify integrity. Default
  flow is the local cache.
- The DB is a local SQLite file owned by the user; no remote sync is wired in.
