# Security Audit — Khoji v1.0.0

Offline-first AI knowledge workspace (Tauri v2 + React + Python + Rust). Audit covers the pre-submission threat surface. Severity: **HIGH** · **MED** · **LOW** · **OK**.

---

## 1. File validation / Path traversal
- **Finding:** `validate_file_path` canonicalizes (resolves `..`, symlinks, absolute) and checks the extension, but enforces **no directory containment**. Any absolute path ending in an allowed extension (`pdf/docx/pptx/epub/png/jpg/jpeg`) **anywhere on disk** is accepted (`lib.rs:11-25`).
- **Severity:** MED
- **Why it matters:** If the renderer were ever compromised (see CSP below), it could read arbitrary files renamed to an allowed extension.
- **Fix:** Constrain the canonical path to an allowed base dir (e.g. `~/Documents` or app data) and reject escapes.
- **NUL bytes:** `canonicalize` rejects embedded NUL via the OS call → returns `Err` (`lib.rs:13`). Acceptable; add an explicit `contains('\0')` guard for clarity.

## 2. Path traversal (read)
- **Finding:** No traversal beyond the file's own content. The Python side re-checks `exists()` (`handlers.py:27`, `processor.py:130`).
- **Severity:** OK

## 3. Prompt injection
- **Finding:** Document notes / user content are concatenated **unsanitized** into the LLM prompt/system context (`handlers.py:206-209` chat, `:343-348` chat_stream). A malicious document could attempt to steer answers.
- **Severity:** LOW
- **Why low:** Local offline model + local data; no exfiltration channel. No cloud API to leak to.
- **Fix (defense-in-depth):** Wrap document content in explicit fenced delimiters and instruct the model to treat it as data, not instructions.

## 4. Unsafe parsing
- **Finding:** All document/extractor parsing is standard library (PyMuPDF, python-docx, etc.) with per-page `try/except`. No `eval`/`pickle`/`yaml.load` on untrusted input.
- **Severity:** OK

## 5. SQLite safety
- **Finding:** Every value binding uses `?` placeholders (`db.py:66-70,75,79,93-98,131-145,153,158…`). `doc_id`/`query`/`content` are all parameterized. `search_chunks` LIKE is parameterized.
- **Severity:** OK (parameterized throughout)
- **LOW — column-name interpolation:** `update_document` builds the SET clause via `f"{k} = ?"` (`db.py:86-88`). Currently only ever called with the hardcoded `status=` kwarg (`processor.py:194`), so **not user-reachable today**.
  - **Fix:** Whitelist allowed column names.
- **LOW — wildcard:** `LIKE f"%{query}%"` (`db.py:144`) — a query of `%`/`_` matches everything; not injection, just wildcard behavior. Escape `%`/`_` if exact-substring is intended.

## 6. Temporary files / Outputs
- **Finding A (OK):** No upload temp files — the original file is read in place (`processor.py:127`); nothing to clean up.
- **Finding B (MED — data loss):** `save_export` (and the exporter path) writes to `~/Documents` with **fixed filenames** (`notes.md`, `document.json`, `library.csv`, …) and **silently overwrites** existing user files (`exporter.py:159-165`, `FORMAT_HANDLERS` at `:138-147`). The IPC `export_document` handler only returns content (no filesystem write), so the live risk is limited to the unused `save_export` path.
  - **Fix:** Derive a unique name (doc title + timestamp) or route through the Tauri dialog so the user chooses the path.
- **Finding C (OK):** `ocr_pdf_page` writes a temp PNG then `unlink`s it (`ocr.py:55-64`).

## 7. Permissions / Capabilities
- **Finding:** Capabilities are minimal — only `core:default` + `dialog:default` (`capabilities/default.json:8-11`). No `fs`, `shell`, or broad protocol access. Appropriately scoped, **not excessive**.
- **Severity:** OK

## 8. CSP (Content-Security-Policy)
- **Finding:** `tauri.conf.json:25-27` sets `"csp": null` — CSP is **disabled** in the webview. If any LLM/frontend output is ever rendered as HTML, the XSS blast radius is maximal.
- **Severity:** MED
- **Fix:** `"csp": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';"` (note: `dangerouslySetInnerHTML` is used for the search snippet — keep query escaping and consider sanitizing `result.snippet`).

## 9. Subprocess spawn
- **Finding:** Engine launched via `Command::new(python).args(["-v","-m","khoji_engine.main"])` — **no shell, no interpolation** (`lib.rs:123-128`). `KHOJI_ENGINE` env var is only used to *locate* the script (`PathBuf` + `.exists()`), never executed (`lib.rs:101-104`). `tesseract` invoked as a list, no `shell=True` (`ocr.py:117-122`).
- **Severity:** OK (no command injection)
- **LOW:** `-v` verbose flag left in production launch (`lib.rs:124`) — log noise, not a vuln.

## 10. Environment hardening
- **Finding:** `env_remove` strips `LD_LIBRARY_PATH`/`PYTHONHOME`/`PYTHONPATH`/`APPIMAGE`/`APPDIR` before spawn (`lib.rs:131-133`) — good hardening against host-Python interference.
- **Severity:** OK

## 11. Crash recovery
- **Finding A (MED):** The engine is a **single `Mutex<Child>` with no watchdog or auto-restart**. If Python dies mid-request: `send_message` → `check_engine_alive` returns an error (`lib.rs:159-168`); streaming → `read_stream` returns `"Stream ended unexpectedly"` (`lib.rs:53`). After that, **every command fails until the user restarts the app**.
  - **Fix:** Detect child exit and respawn the engine (and re-emit `ready`).
- **Finding B (MED):** **No read timeout** on engine stdout (`read_line` `lib.rs:179-183`, `lines()` `lib.rs:39`). If the engine hangs (e.g. stuck model generation), the Rust command thread blocks forever and the UI freezes.
  - **Fix:** Add read timeouts / a periodic heartbeat `ping`.
- **Finding C (LOW):** `start_python_engine().expect(...)` (`lib.rs:475`) panics the whole app if launch fails — acceptable, but yields no graceful UI message.
- **Finding D (LOW):** If a handler panics while holding the `Mutex`, it becomes poisoned and all subsequent commands error. Fix: `into_inner()` recovery or panic-safe scope.

## 12. AppImage packaging
- **Finding A (MED):** `scripts/build-linux.sh` sets `APPIMAGE_EXTRACT_AND_RUN=1` (`:26`) → the AppImage extracts to a **world-writable temp dir** (`/tmp/.mount-…`) on multi-user systems; another local user could tamper with/race the extracted binaries.
  - **Fix:** Run from the mount (drop the env) or tighten temp-dir perms.
- **Finding B (MED):** Checksums are generated (`build-linux.sh:36-39`, sha256) — good for integrity — but **not signed** (no GPG). Users can't verify authenticity.
  - **Fix:** Sign the checksums / GPG-sign the AppImage.
- **Finding C (LOW):** The built AppImage (~105 MB) sits in the repo root and was likely committed; `.gitignore` should add `*.AppImage` to avoid repo bloat (fixed in this audit: `*.AppImage` + `target/` + `node_modules/` now ignored).

## 13. Network egress
- **Finding:** During normal operation **no user data leaves the device**. The only network use is **one-time, optional model download** (embedding model auto-fetch on first `load()`; LLM GGUF via `urllib.request.urlretrieve`). Pre-stage `~/.cache/huggingface` + `~/.khoji/models` for a fully air-gapped demo. See `LOCAL_AI_VERIFICATION.md`.
- **Severity:** OK (by design)

---

## Summary
- **Strongest:** Parameterized SQL throughout, safe subprocess spawn, minimal Tauri capabilities, env hardening, no upload temp-file leakage.
- **Weakest (all MED):** disabled CSP, no engine crash-recovery/restart, no directory containment on file paths, AppImage world-writable temp extract + unsigned artifacts, silent export overwrite.
- **No HIGH-severity issues found.** Prompt injection is LOW (local offline model).
- **Recommended pre-submission fixes:** enable CSP, add engine restart + read timeout, constrain file-path containment, sign the AppImage.
