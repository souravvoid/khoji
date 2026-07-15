# Security Report — Khoji v1.0.0

Khoji is built with an **offline-first, zero-egress architecture**. No telemetry, document content, or chat history is transmitted to external servers. This report reviews the threat model, security posture, and vulnerability fixes verified in this audit.

---

## 1. Threat Model & Egress Analysis
- **Zero-Egress Design:** Document extraction, chunking, database storage, vector similarity indexing, and LLM text generation occur entirely locally on the host machine.
- **Network Activities:** 
  - Network requests are restricted strictly to **model downloads** (caching the `sentence-transformers` embedding model on first import, and downloading chosen LLM GGUF models on demand from Hugging Face).
  - All communication between the Tauri desktop wrapper and the Python AI subprocess runs over a local pipe (stdin/stdout). No local HTTP servers or network ports are opened.

---

## 2. Security Vulnerabilities Fixed

### 🚨 RCE-capable XSS in Search Result Highlighting (RESOLVED)
- **Vulnerability:** Search hit snippets were displayed in the React frontend using `dangerouslySetInnerHTML` without escaping the original text. A document containing malicious HTML or JavaScript could achieve cross-site scripting (XSS) inside the WebView. In Tauri, XSS could lead to remote code execution (RCE) by leveraging bridge APIs.
- **Mitigation:** Added an `escapeHtml()` sanitizer in `SearchResultItem.tsx`. All document snippets and search queries are fully sanitized before mark highlighted text is rendered.

### 🔒 Directory Path Traversal Prevention (RESOLVED)
- **Vulnerability:** The Rust backend's path validation check used `p.starts_with(forbidden)` to block system-sensitive directories. However, this pattern caused false-positives on sister directories (e.g. blocking a folder named `/etc_custom`).
- **Mitigation:** Updated `validate_file_path()` in `lib.rs` to verify exact matching and subdirectory boundary matching using `p == forbidden || p.starts_with(&format!("{}/", forbidden))`.

---

## 3. Database & Query Safety
- **SQLite Parameterization:** Every database command in `db.py` uses parameterized query bindings (`?` placeholders). This completely immunizes the application from SQL injection (SQLi).
- **Auto-Escaped Updates:** System metadata updates (like changing document status) are constructed through whitelisted keyword dictionaries, ensuring no raw user strings are concatenated into DDL or DML statements.

---

## 4. Tauri Sandbox & Capabilities
- **Strict Capabilities:** Tauri v2 capability configuration (`capabilities/default.json`) restricts access to essential plugins: `core:default` and `dialog:default`.
- **System-level Protection:** The application does **not** enable filesystem write permissions (`fs`) or subprocess execution permissions (`shell`) for the renderer. Only the compiled Rust shell communicates directly with the Python engine subprocess.
- **Hardened Subprocess Launcher:** The Python AI engine subprocess is spawned directly by binary name and module flag (`python3 -v -m khoji_engine.main`). It is never passed through a shell interpreter, preventing command injection.
- **Content-Security-Policy (CSP):** A restrictive CSP is defined in `tauri.conf.json`, allowing connection strictly to Tauri IPC and local image assets.
