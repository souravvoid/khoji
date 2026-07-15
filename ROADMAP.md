# Khoji — Roadmap

## Current State (v1.0.0)

### Completed Features
- [x] Document processing (PDF, DOCX, PPTX, EPUB, images)
- [x] OCR fallback (RapidOCR → Tesseract)
- [x] Semantic search (embeddings + FAISS)
- [x] Local LLM chat (Qwen2.5 GGUF models)
- [x] **Streaming IPC** — chat tokens + processing progress via NDJSON
- [x] Flashcard generation (rule-based, 20/doc)
- [x] Quiz generation (rule-based MCQ, 10/doc)
- [x] Timeline extraction (regex-based)
- [x] Mind map generation (heading-based Mermaid)
- [x] Markdown notes editor
- [x] Multi-format export (8 formats)
- [x] Model management (download, select, hardware detection)
- [x] Spaced repetition review (SM-2 algorithm)
- [x] Keyboard shortcuts (6 global)
- [x] Dark/light/system theme
- [x] BMW M-inspired design system
- [x] E2E tests (14 tests, Playwright)
- [x] Backend verification suite
- [x] Linux AppImage packaging

### Known Limitations
- No conversation history in chat (single-turn only)
- No workspace isolation (schema exists, no UI)
- No encryption at rest
- CSP disabled
- FAISS full rebuild on document deletion
- Single-threaded Python bottleneck (Mutex)
- No memory management for LLM
- No multi-provider LLM support

## v1.1 — Conversation, Multi-File & Polish (Next Sprint)

### Priority 1: Conversation History
**Effort**: 1 day
**Description**: Send recent chat history to LLM with document context. Multi-turn conversations.

**Tasks**:
- [ ] Modify `handle_chat` / `handle_chat_stream` to include last N messages
- [ ] Update prompt construction to include history
- [ ] Test multi-turn conversation quality
- [ ] Load chat history from DB on session open

### Priority 2: Batch Document Processing
**Effort**: 1 day
**Description**: Allow selecting multiple files at once. Queue with progress.

**Tasks**:
- [ ] Update file dialog to accept multiple files
- [ ] Modify `handleFilesSelected` to queue multiple jobs
- [ ] Add queue management UI (pause, resume, cancel)

### Priority 3: Sidebar Navigation Fix
**Effort**: 2h
**Description**: Learn/Tools nav items all go to library instead of document tabs.

**Tasks**:
- [ ] Route sidebar items to correct destinations
- [ ] Open document tabs from Learn section

### Priority 4: Export Toggles Wiring
**Effort**: 2h
**Description**: Include/exclude toggles exist in UI but not sent to backend.

**Tasks**:
- [ ] Wire toggle state to export IPC call
- [ ] Respect toggles in exporter.py

### Priority 5: Testing Coverage
**Effort**: 1 day
**Description**: Increase test coverage for backend and frontend.

**Tasks**:
- [ ] Add unit tests for database CRUD operations
- [ ] Add frontend component tests
- [ ] Add E2E tests for streaming chat
- [ ] Add E2E tests for batch processing

## v1.2 — Multi-Provider & Workspaces

- Multi-provider LLM (Ollama, OpenAI-compatible)
- Workspace isolation (UI + DB scoping)
- MCP server for external AI agents
- Encryption at rest (sqlcipher)
- FAISS incremental updates (no full rebuild)

## v2.0 — Advanced

- Podcast/audio generation (local TTS)
- Knowledge graph (similarity-based document graph)
- Plugin system (custom extractors, generators, exporters)

## v3.0 — Long-term

- Mobile companion (iOS/Android via Tauri mobile)
- Collaborative features (shared workspaces, sync)
- Advanced AI (GPU acceleration, multi-modal, fine-tuning)
