# Khoji — Technical Report

A judging narrative for the OSDHack 2026 submission. Khoji is an offline-first AI
knowledge workspace: drop a document and get notes, flashcards, quizzes, timelines,
mind maps, and a streaming RAG chat — all performed on-device. This report states what
was built, why, and how the hard parts were solved.

---

## 1. Overview

Khoji turns static files (PDF, DOCX, PPTX, EPUB, images) into an interactive, queryable
knowledge base that never leaves the user's machine. The application is a Tauri v2
desktop shell hosting a React 19 + TypeScript frontend and a long-lived Python 3.12 AI
engine. The engine extracts text, embeds it with a local sentence-transformer, indexes
it in a local FAISS store, and answers questions with a local GGUF language model. The
rust layer is a thin, security-conscious transport: it spawns and supervises the Python
process, validates file paths, and bridges messages between the WebView and the engine
over stdin/stdout.

The product differs from cloud RAG tools (NotebookLM, ChatGPT file upload) by guaranteeing
zero network egress: no API calls, no telemetry, no document content transmitted. This is
the core design constraint that shapes every architectural decision below.

---

## 2. Problem & Motivation

Students, researchers, and knowledge workers routinely accumulate long PDFs, slide decks,
and EPUBs they must actually *learn*, not just store. Existing AI assistants that help
with this require uploading the material to a third-party server — unacceptable for
confidential drafts, unpublished research, or simply privacy-minded users. A second
problem is interactivity: most local tools either only summarize or only chat, and few
produce *study-grade* artifacts (flashcards with spaced repetition, quizzes, timelines,
mind maps) from a single upload.

Khoji targets both gaps:
- **Privacy/offline-first.** Everything runs locally; the machine's RAM and disk are the
  only places data lives.
- **Learning-oriented output.** Beyond chat, it generates flashcards (SM-2 spaced
  repetition), quizzes, timelines, and mind maps, so a document becomes a study plan.

The target hardware is a modest laptop (Intel Core i5, 8 GB RAM, integrated graphics), so
the entire stack is CPU-only and memory-bounded by design.

---

## 3. Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| Desktop shell | Tauri v2 (Rust) | Window, process supervision, IPC bridge, file dialogs |
| Frontend | React 19 + TypeScript + Vite | UI, components, state |
| State | Zustand (5 stores) | uiStore, documentStore, chatStore, settingsStore, reviewStore |
| Styling | Tailwind CSS v4 + CSS tokens | "Industrial precision" theme, light/dark/system |
| Backend engine | Python 3.12 | Document processing, AI, DB |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | 384-dim text vectors |
| Vector search | FAISS `IndexFlatIP` | Cosine similarity (brute-force) |
| LLM | llama-cpp-python, GGUF Q4_K_M | Local chat inference, token streaming |
| Database | SQLite (WAL) | 7-table persistence under `~/.khoji` |
| PDF/OCR | PyMuPDF, RapidOCR, Tesseract | Text + image extraction |
| Docs | python-docx, python-pptx, ebooklib | DOCX/PPTX/EPUB extraction |
| Testing | Playwright (E2E), pytest (engine) | |

---

## 4. System Architecture

The system is a three-layer pipeline: **React frontend → Rust shell → Python engine**,
connected by a JSON-over-stdin/stdout bridge (see `ARCHITECTURE.md` §1 and §3). The Rust
`lib.rs` registers 21 Tauri commands; 19 are request/response (e.g. `search_documents`,
`generate_flashcards`, `export_document`, `save_chat_session`) and 2 are streaming
(`ask_ai_stream`, `process_document_stream`).

Document ingestion (`ARCHITECTURE.md` §2) routes by extension to a dedicated extractor,
falls back to OCR for images, normalizes to markdown, chunks at 1000 characters with 200
overlap, embeds each chunk, adds it to the FAISS index, and writes all artifacts to
SQLite. Chat and search embed the query, retrieve the top-k chunks from FAISS, and feed
them as context to the local LLM. The LLM streams tokens that Rust re-emits as
`stream-token` events the frontend renders incrementally.

The clean separation — no business logic in Rust, no UI in Python — keeps each layer
replaceable and testable, and means the AI ecosystem (PyTorch, FAISS, llama-cpp) lives
entirely behind a stable JSON contract.

---

## 5. Key Technical Challenges & Solutions

### 5.1 Offline-first, no network egress
**Challenge.** Run embeddings and an LLM with zero cloud dependency, on CPU, within an 8 GB
budget.
**Solution.** `all-MiniLM-L6-v2` (80 MB, 384-dim) runs comfortably on CPU and is
pre-warmed in a background thread at startup (`main.py`) so first query latency is hidden.
The LLM uses 4-bit Q4_K_M GGUF models via llama-cpp-python with `n_gpu_layers=0`
(CPU-only). `detect_hardware()` (`ai/llm.py`) inspects available RAM via `psutil` and
selects the largest model that fits, defaulting to `qwen2.5-0.5b` (~500 MB) and falling
back to `tinyllama-1.1b` when `psutil` is absent. No HTTP client is used at inference
time; the only network touch is an optional on-demand model download.

### 5.2 Streaming IPC to avoid UI freeze
**Challenge.** Embedding + LLM generation can take seconds; a blocking request would
freeze the WebView. The internal docs once claimed "no streaming" — that is obsolete.
**Solution.** The engine distinguishes sync vs streaming actions (`STREAMING_ACTIONS` in
`main.py`). Streaming handlers write multiple NDJSON lines; Rust `read_stream()`
(lib.rs:33) forwards each via `app.emit("stream-token", content)` and `app.emit(
"progress-update", {...})` while reading until `{"type":"end"}`. The frontend
`lib/ipc.ts` `listen()`s and accumulates tokens/ progress, so the UI stays responsive and
shows live processing stages (OCR → extract → markdown → chunk → embed → content).

### 5.3 FAISS semantic search
**Challenge.** Retrieve relevant chunks by meaning, not keywords, locally and fast.
**Solution.** Chunks are embedded with L2-normalized vectors, so FAISS `IndexFlatIP`
inner product equals cosine similarity. The index is persisted to
`~/.khoji/vectors/vectors.index` + `metadata.json` and guarded by a `threading.Lock()`.
Search is O(n) brute-force but sub-10 ms for tens of thousands of vectors — more than
enough for a personal library. Deletion rebuilds the index from surviving vectors.

### 5.4 Rule-based study material (no LLM needed)
**Challenge.** Generating flashcards/quizzes should not depend on — or burn the tokens of
— the small local LLM, and must work even before a model is downloaded.
**Solution.** `pipeline/content_generator.py` is deterministic and rule-based: it splits
on sentence boundaries, detects definition patterns ("X is/refers to Y") and fact patterns
(numbers, frequencies), and synthesizes up to 20 flashcards and 10 MCQs with distractors
drawn from other sentences. `pipeline/structure_generator.py` extracts timelines via date
regexes and builds Mermaid mind maps from heading hierarchy. This keeps study generation
instant, free, and reproducible.

### 5.5 Secure, supervised process bridge
**Challenge.** The frontend must never touch the filesystem or network directly.
**Solution.** Rust exposes only `core:default` and `dialog:default` capabilities; no fs/
http/shell plugins. `process_document` validates the path (`validate_file_path`:
canonicalize, confirm it is a file, enforce an extension allowlist
`pdf/docx/pptx/epub/png/jpg/jpeg`) before forwarding. The Python child's environment is
stripped of conflicting vars, preventing AppImage stdlib breakage.

---

## 6. Performance Characteristics

Measured on CPU (Intel i5 class), from `docs/internal/AI_PIPELINE_EXPLAINED.md`:

| Operation | Time | Memory |
|-----------|------|--------|
| Embedding model load | 2–3 s (pre-warmed) | ~80 MB |
| Embed 100 chunks | <1 s | ~80 MB |
| FAISS search (10K vectors) | <10 ms | ~15 MB |
| LLM load `qwen2.5-0.5b` | 5–10 s (lazy, first use) | ~500 MB |
| LLM generate 100 tokens (0.5B) | 1–3 s | ~500 MB |
| LLM load `qwen2.5-1.5b` | 10–15 s | ~1.2 GB |
| Flashcard/quiz generation | <1 s | negligible |

Peak footprint with the default model is under 2 GB, within an 8 GB laptop. The dominant
cost is the one-time lazy LLM load, masked in practice because loading happens on the
first chat while the UI already shows the document. Streaming keeps perceived latency low
during generation.

---

## 7. On-Device AI Justification

Running AI locally is not a limitation imposed by circumstance but the product's central
value proposition:
- **Privacy.** Document contents never leave the device; there is no server that could
  be subpoenaed, breached, or rate-limited.
- **Cost & availability.** No per-token API fees, no account, no network required — the
  app works on a plane or in a lab with no connectivity.
- **Small-model pragmatism.** 4-bit quantized 0.5–1.7B models are deliberately chosen for
  the target hardware. They are not frontier-LLM quality, but for grounded RAG over a
  single document with retrieved context, they answer accurately and instantly enough to
  be useful, and `detect_hardware()` upgrades automatically when more RAM is available.
- **Reproducibility.** Rule-based study generation is deterministic, so the same document
  yields the same flashcards/quiz every time — important for learning.

---

## 8. Limitations

Stated honestly for judges:
- **Single Python subprocess, serialized by `Mutex<Child>`.** A long ingestion blocks
  other commands; mitigated by event streaming rather than polling, but true concurrency
  (parallel documents) is not yet supported.
- **FAISS full save on every mutation** and full index rebuild on document deletion — O(n)
  in vectors; fine at personal scale, not at corpus scale.
- **No encryption at rest.** SQLite and FAISS files are plaintext under `~/.khoji`.
- **No multi-provider LLM / GPU offload.** Inference is CPU-only local GGUF; `n_gpu_layers`
  is fixed at 0.
- **LLM quality ceiling.** Small quantized models can drift on open-ended questions;
  answers are grounded in retrieved chunks to mitigate this.
- **Frontend has no normalized/derived state** beyond the five Zustand stores; acceptable
  for the current scope.
- **Test coverage is modest** (Playwright E2E + pytest engine tests); the IPC contract and
  pipeline are covered, but exhaustive backend unit coverage is future work.

These are scoped trade-offs for a hackathon-built, privacy-first desktop tool, and each
has a clear upgrade path (async command queue, incremental FAISS saves, at-rest
encryption, optional GPU layers) without changing the core offline architecture.
