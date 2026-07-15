# Roadmap

## Current State (v1.0.0)

### Completed Features
- [x] Document processing (PDF, DOCX, PPTX, EPUB, images)
- [x] OCR fallback (RapidOCR → Tesseract)
- [x] Semantic search (embeddings + FAISS)
- [x] Local LLM chat (Qwen2.5 GGUF models)
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
- [x] CI/CD (GitHub Actions)

### Known Limitations
- No streaming IPC (UI freezes during long operations)
- No progress callbacks (polling only)
- No conversation history in chat
- No workspace isolation
- No encryption at rest
- No CSP (Content Security Policy disabled)
- Single-threaded Python bottleneck (Mutex)
- FAISS full rebuild on document deletion
- No memory management for LLM

## v1.1 — Streaming & Polish (Next Sprint)

### Priority 1: Streaming IPC
**Impact**: High
**Effort**: 2-3 days
**Description**: Replace synchronous request/response with streaming responses. Frontend displays tokens in real-time during LLM generation.

**Tasks**:
- [ ] Implement chunked JSON protocol in Python
- [ ] Add streaming support in Rust bridge
- [ ] Update frontend to handle streaming responses
- [ ] Add typing indicator during generation

### Priority 2: Progress Callbacks
**Impact**: High
**Effort**: 1 day
**Description**: Send real-time progress from Python during document processing. Frontend shows granular progress instead of polling.

**Tasks**:
- [ ] Add progress callback to `send_message()`
- [ ] Emit progress events from `process_document`
- [ ] Update `ProcessingModal` to show real progress
- [ ] Add per-page progress for OCR

### Priority 3: Conversation History
**Impact**: Medium
**Effort**: 0.5 day
**Description**: Send recent chat history to LLM along with document context. Enables multi-turn conversations.

**Tasks**:
- [ ] Modify `handle_chat` to include last N messages
- [ ] Update prompt construction to include history
- [ ] Test multi-turn conversation quality

### Priority 4: Batch Document Processing
**Impact**: Medium
**Effort**: 1 day
**Description**: Allow selecting multiple files at once. Process them sequentially with queue management.

**Tasks**:
- [ ] Update file dialog to accept multiple files
- [ ] Modify `handleFilesSelected` to queue multiple jobs
- [ ] Add queue management UI (pause, resume, cancel)

## v1.2 — Multi-Provider & Workspaces (Next Month)

### Priority 5: Multi-Provider LLM Support
**Impact**: High
**Effort**: 1 week
**Description**: Support Ollama, OpenAI-compatible APIs, and cloud providers alongside local GGUF models. Hybrid local/cloud mode.

**Tasks**:
- [ ] Abstract LLM interface
- [ ] Add Ollama provider
- [ ] Add OpenAI-compatible provider
- [ ] Add Anthropic provider
- [ ] Add provider selection UI
- [ ] Implement hybrid mode (local for privacy, cloud for quality)

### Priority 6: Workspace Isolation
**Impact**: Medium
**Effort**: 1 week
**Description**: Named workspaces with isolated document collections, embedding indices, chat history, and system prompts.

**Tasks**:
- [ ] Add `workspaces` table to database
- [ ] Scope all queries by workspace_id
- [ ] Add workspace selection UI
- [ ] Implement workspace switching
- [ ] Migrate existing data to default workspace

### Priority 7: MCP Server
**Impact**: High
**Effort**: 1 week
**Description**: Expose Khoji's document index and embeddings as an MCP server for external AI agents.

**Tasks**:
- [ ] Implement MCP server in Python
- [ ] Expose `search`, `get_document`, `chat` tools
- [ ] Add MCP configuration UI
- [ ] Document MCP API

## v2.0 — Advanced Features (Next Quarter)

### Priority 8: Podcast/Audio Generation
**Impact**: High
**Effort**: 2 weeks
**Description**: Generate multi-speaker audio summaries from document collections using local TTS.

**Tasks**:
- [ ] Integrate local TTS (Piper or XTTS)
- [ ] Generate script from document content
- [ ] Add multi-speaker support
- [ ] Implement audio export
- [ ] Add playback controls

### Priority 9: Knowledge Graph
**Impact**: Medium
**Effort**: 2 weeks
**Description**: Interactive graph showing document relationships based on embedding similarity.

**Tasks**:
- [ ] Compute document similarity matrix
- [ ] Implement force-directed graph (D3.js)
- [ ] Add document clustering
- [ ] Implement graph navigation
- [ ] Add export to GraphML

### Priority 10: Plugin System
**Impact**: Medium
**Effort**: 4 weeks
**Description**: Allow users to add custom extractors, content generators, and export formats.

**Tasks**:
- [ ] Define plugin API
- [ ] Implement plugin loader
- [ ] Add plugin sandboxing
- [ ] Create plugin registry
- [ ] Document plugin development

## v3.0 — Long-term Vision

### Mobile Companion
- Tauri mobile support (iOS/Android)
- Sync data via local network or encrypted cloud
- Review flashcards on the go
- Search documents from mobile

### Collaborative Features
- Multi-user support
- Shared workspaces
- Comments on documents
- Shared flashcard decks
- Real-time sync (WebSocket or CRDT)

### Advanced AI
- GPU acceleration (CUDA/Metal)
- Custom model fine-tuning
- Multi-modal support (images, audio)
- Automated summarization
- Citation tracking

## Release Schedule

| Version | Target Date | Key Features |
|---------|------------|--------------|
| v1.0.0 | Released | Core features |
| v1.1.0 | +1 week | Streaming, progress, conversation |
| v1.2.0 | +1 month | Multi-provider, workspaces, MCP |
| v2.0.0 | +1 quarter | Podcast, knowledge graph, plugins |
| v3.0.0 | +6 months | Mobile, collaboration, advanced AI |

## Success Metrics

### v1.1
- [ ] LLM responses stream in <100ms latency
- [ ] Document processing shows real progress
- [ ] Multi-turn chat works with 5+ messages

### v1.2
- [ ] Ollama integration works with 3+ models
- [ ] Workspace switching preserves all data
- [ ] MCP server accepts connections from Claude Code

### v2.0
- [ ] Podcast generation produces 5+ minute audio
- [ ] Knowledge graph renders 50+ documents
- [ ] Plugin system supports custom extractors

## Contributing

See `CONTRIBUTING.md` for guidelines on contributing to any version.
