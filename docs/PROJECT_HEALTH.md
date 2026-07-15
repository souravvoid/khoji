# Khoji — Project Health

> Last updated: 2026-07-14

| Area | Rating | Notes |
|------|--------|-------|
| **Architecture** | ★★★★☆ | Clean 3-layer separation (React ↔ Rust ↔ Python). Mutex bottleneck on IPC. No dependency injection in Python. |
| **Frontend** | ★★★★☆ | 31 well-structured components, 5 Zustand stores. No normalized/derived state. Sidebar nav still broken. |
| **Backend** | ★★★★☆ | Comprehensive pipeline, deferred imports for fast startup, streaming IPC landed. Singleton anti-pattern. No DI. |
| **Database** | ★★★★★ | SQLite WAL, clean 7-table schema, adequate for desktop use. No encryption. |
| **AI** | ★★★☆☆ | Works but limited: rule-based content gen (no LLM), no multi-turn chat, no GPU, single local LLM provider only. |
| **OCR** | ★★★★☆ | Dual RapidOCR + Tesseract fallback. Works reliably. Moderate speed on image-heavy PDFs. |
| **Performance** | ★★★★☆ | ~1.6GB peak RAM well within 8GB target. Streaming IPC prevents UI freeze. Cold LLM load still slow (~10s). |
| **Testing** | ★★★☆☆ | 14 Playwright E2E + 2 pytest. No unit tests for core logic. No component tests. |
| **Security** | ★☆☆☆☆ | CSP disabled entirely. No input sanitization on chat/notes. No encryption at rest. Secrets in env. |
| **Documentation** | ★★★★★ | Extensive: project context, architecture diagrams, decision records, roadmap, health. Session reports. |

## Trends

- **Streaming IPC** implemented — major UX improvement, roadmap priority delivered
- **Styling polish** — flashcard flip, reading mode, transitions all refined
- **Packaging** — AppImage functional, build pipeline works
- **Documentation** — consistently maintained

## Risks

1. **Mutex bottleneck** — all IPC serialized through single Rust Mutex. Not fixable without architectural change to streaming-only or multiple Python processes.
2. **No conversation history** — chat is single-turn only. DB schema exists, frontend not wired.
3. **Security debt** — CSP disabled means XSS risk. No encryption on local database.
4. **Test coverage** — core AI/generation logic untested. Regression risk when refactoring.
5. **FAISS full rebuild** — delete+re-add cycle O(n) rebuild on every document deletion.

## Verdict

Solid MVP with working end-to-end flow. Streaming IPC completes the critical UX gap. Next focus: conversation history and test coverage before adding new features.
