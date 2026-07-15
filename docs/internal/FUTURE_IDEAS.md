# Future Ideas & Roadmap

## Competitive Analysis Summary

| Project | Key Strength | Khoji Advantage |
|---------|-------------|-----------------|
| AnythingLLM | Workspace isolation, multi-provider | OCR, flashcards, quizzes, native desktop |
| PrivateGPT | API-first, agentic RAG | End-user app, not developer framework |
| Open Notebook | Podcast generation, multi-provider | OCR, flashcards, quizzes, native desktop |
| Obsidian | Plugin ecosystem, graph view | All-in-one, no assembly required |
| Logseq | Outliner UI, MCP server | Simpler UX, document processing |
| Open WebUI | Chat UI, plugin marketplace | Document workspace, not chat interface |
| Khoj | Agents, automations | Native desktop, OCR, study tools |

## Improvement Ideas (Prioritized)

### Tier 1: MVP Enhancements (Next Sprint)

#### 1. Streaming IPC
**Impact**: High — eliminates UI freezes during LLM generation
**Difficulty**: Medium
**Description**: Replace synchronous request/response with streaming responses. Send chunks as they're generated. Frontend displays tokens in real-time.

**Implementation**: Use Server-Sent Events (SSE) over the existing stdin/stdout pipe, or implement a chunked JSON protocol.

#### 2. Progress Callbacks
**Impact**: High — shows real progress during document processing
**Difficulty**: Low
**Description**: Send `(stage, percent)` tuples from Python to frontend during `process_document`. Frontend displays granular progress instead of polling.

**Implementation**: Add a progress callback to `send_message()` that sends intermediate updates.

#### 3. Conversation History in Chat
**Impact**: Medium — enables multi-turn conversations
**Difficulty**: Low
**Description**: Send recent chat history to LLM along with document context. Currently only document context is sent.

**Implementation**: Modify `handle_chat` to include last N messages in the prompt.

### Tier 2: Version 1.1

#### 4. Podcast/Audio Overview Generation
**Impact**: High — unique feature, high user demand
**Difficulty**: Medium
**Description**: Generate multi-speaker audio summaries from document collections using local TTS (Piper, Bark, or XTTS).

**Implementation**: Add a new handler that generates a script from document content, then converts to audio using a local TTS model.

#### 5. Multi-Provider LLM Support
**Impact**: High — expands user base significantly
**Difficulty**: Medium
**Description**: Support Ollama, OpenAI-compatible APIs, and cloud providers alongside local GGUF models. Hybrid local/cloud mode.

**Implementation**: Abstract the LLM interface, add provider adapters for Ollama, OpenAI, Anthropic, Google.

#### 6. Workspace Isolation
**Impact**: Medium — better organization for power users
**Difficulty**: Medium
**Description**: Named workspaces/projects with isolated document collections, embedding indices, chat history, and system prompts.

**Implementation**: Add a `workspaces` table, scope all queries by workspace_id.

#### 7. Knowledge Graph Visualization
**Impact**: Medium — helps users discover document relationships
**Difficulty**: High
**Description**: Interactive graph showing document relationships based on embedding similarity and extracted entities.

**Implementation**: Use D3.js or vis.js to render a force-directed graph. Compute edges from embedding cosine similarity.

#### 8. Batch Document Processing
**Impact**: Medium — improves UX for multiple documents
**Difficulty**: Low
**Description**: Allow selecting multiple files at once and processing them sequentially with a queue.

**Implementation**: Modify `handleFilesSelected` to accept multiple files. Frontend already has `processingQueue`.

### Tier 3: Version 2.0

#### 9. MCP Server
**Impact**: High — turns Khoji into infrastructure
**Difficulty**: Medium
**Description**: Expose Khoji's document index and embeddings as an MCP server, allowing external AI agents (Claude Code, OpenCode) to query the knowledge base.

**Implementation**: Add an MCP server in Python that exposes `search`, `get_document`, and `chat` tools.

#### 10. Collaborative Features
**Impact**: Medium — enables team use
**Difficulty**: High
**Description**: Multi-user support with shared workspaces, comments on documents, and shared flashcard decks.

**Implementation**: Requires authentication, shared database, real-time sync (WebSocket or CRDT).

#### 11. Mobile Companion
**Impact**: Medium — extends reach
**Difficulty**: High
**Description**: Tauri supports iOS/Android. A mobile companion for reviewing flashcards and searching documents on the go.

**Implementation**: Use Tauri's mobile support. Sync data via local network or encrypted cloud storage.

#### 12. Plugin System
**Impact**: Medium — extensibility
**Difficulty**: High
**Description**: Allow users to add custom extractors, content generators, and export formats via plugins.

**Implementation**: Define a plugin API, implement a plugin loader, sandbox plugins.

### Tier 4: Long-term Vision

#### 13. OCR Quality Improvement
**Impact**: Medium — better text extraction
**Difficulty**: Medium
**Description**: Use a more accurate OCR engine (e.g., Surya, Got-OCR) for better text extraction from scanned documents.

#### 14. Advanced Flashcard Algorithms
**Impact**: Low — better SRS
**Difficulty**: Low
**Description**: Implement FSRS (Free Spaced Repetition Scheduler) instead of SM-2 for more efficient learning.

#### 15. Document Comparison
**Impact**: Medium — new use case
**Difficulty**: High
**Description**: Compare two documents side-by-side, highlighting similarities and differences.

#### 16. Citation Tracking
**Impact**: Medium — academic use case
**Difficulty**: High
**Description**: Track citations between documents, build a citation graph.

#### 17. Automated Summaries
**Impact**: Medium — quick overview
**Difficulty**: Medium
**Description**: Generate executive summaries of documents using the local LLM.

## Implementation Difficulty Matrix

| Idea | Difficulty | Impact | Effort |
|------|-----------|--------|--------|
| Streaming IPC | Medium | High | 2-3 days |
| Progress Callbacks | Low | High | 1 day |
| Conversation History | Low | Medium | 0.5 day |
| Podcast Generation | Medium | High | 1-2 weeks |
| Multi-Provider LLM | Medium | High | 1 week |
| Workspace Isolation | Medium | Medium | 1 week |
| Knowledge Graph | High | Medium | 2 weeks |
| Batch Processing | Low | Medium | 1 day |
| MCP Server | Medium | High | 1 week |
| Collaborative Features | High | Medium | 4+ weeks |
| Mobile Companion | High | Medium | 4+ weeks |
| Plugin System | High | Medium | 4+ weeks |
| OCR Improvement | Medium | Medium | 1 week |
| Advanced SRS | Low | Low | 1 day |
| Document Comparison | High | Medium | 2 weeks |
| Citation Tracking | High | Medium | 2 weeks |
| Automated Summaries | Medium | Medium | 3 days |

## Recommended Priority Order

### Immediate (This Week)
1. Streaming IPC
2. Progress Callbacks
3. Conversation History

### Next Sprint
4. Batch Document Processing
5. Multi-Provider LLM Support
6. MCP Server

### Next Month
7. Podcast/Audio Generation
8. Workspace Isolation
9. Knowledge Graph Visualization

### Future
10. Mobile Companion
11. Collaborative Features
12. Plugin System
