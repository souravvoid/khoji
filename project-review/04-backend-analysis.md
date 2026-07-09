# 04 — Backend Analysis

> Complete audit of the Python AI engine, Tauri/Rust IPC layer, and all service modules.

---

## Architecture: Python Subprocess IPC

The backend is a Python process spawned by Tauri. Communication is **synchronous JSON over stdin/stdout**:

```
Frontend (JS) → invoke('ipc_call', {action, payload})
     ↓
Tauri (Rust) lib.rs → write JSON line to Python stdin
     ↓
Python main.py → read line → handle_message() → JSON response
     ↓
Tauri (Rust) → parse response → return to JS
```

**Protocol format:**
```json
// Request
{"action": "process_document", "payload": {"file_path": "/path/to/doc.pdf"}}

// Response (success)
{"status": "ok", "result": {...}}

// Response (error)
{"status": "error", "error": "Description of what went wrong"}
```

---

## IPC Commands Catalogue (16 total)

| Command | Handler | Description |
|---|---|---|
| `ping` | inline | Health check → `"pong"` |
| `get_documents` | `db.list_documents()` | All documents metadata |
| `get_document` | `db.get_document(id)` | Single document full data |
| `process_document` | `processor.process_document_sync()` | Full pipeline run |
| `get_notes` | `db.get_notes(id)` | Markdown notes for document |
| `get_flashcards` | `db.get_flashcards(id)` | All flashcards for document |
| `get_quiz_questions` | `db.get_quiz_questions(id)` | Quiz MCQs for document |
| `search_documents` | `vector_search.search()` | FAISS semantic search |
| `chat` | `llm.chat()` | LLM inference with document context |
| `generate_timeline` | `structure_generator.generate_timeline()` | Timeline events |
| `generate_mind_map` | `structure_generator.generate_mind_map()` | Topic tree |
| `generate_mermaid` | `structure_generator.generate_mermaid_diagram()` | Mermaid flowchart |
| `export_document` | `exporter.export_document()` | Export to format |
| `get_models` | `llm.get_available_models()` | Model list with status |
| `download_model` | inline (stub) | Model download (stub only) |
| `delete_document` | `db.delete_document()` | Remove from SQLite |

**Note:** `download_model` is a stub that returns `{"status": "ok", "result": "started"}`. Actual model download logic is in `scripts/download-models.py`, not in the IPC handler.

---

## Module Deep-Dive

### `main.py` — IPC Loop

```python
# Startup pattern
import sys, json, logging
def main():
    for line in sys.stdin:
        msg = json.loads(line)
        response = handle_message(msg)
        print(json.dumps(response), flush=True)
```

**Key design decisions:**
- All heavy imports (torch, faiss, llama-cpp) are **lazy** — inside `elif` branches
- Each call to an AI module that requires a model load triggers the load on first call
- First `chat` request will trigger LLM model load (~10-30 seconds on i5)
- First `process_document` or `search_documents` will trigger embedding model load (~60s)

**Problem:** No concurrency. If the frontend sends two requests simultaneously, the second blocks until the first completes. Since Tauri's `invoke` is async on the JS side, multiple rapid calls could queue up correctly, but a long LLM inference blocks all subsequent commands.

**Solution:** The Tauri Rust layer could add a message queue with a dedicated thread. Currently it's synchronous per-call.

---

### `database/db.py` — SQLite Schema

#### Schema (6 tables)

```sql
documents(
  id TEXT PRIMARY KEY,        -- UUID4
  filename TEXT NOT NULL,
  title TEXT,
  file_path TEXT,
  file_size INTEGER,
  page_count INTEGER,
  status TEXT DEFAULT 'pending',  -- pending|processing|processed|ready|error
  created_at TEXT,
  updated_at TEXT
)

chunks(
  id TEXT PRIMARY KEY,
  document_id TEXT → documents.id,
  content TEXT,
  chunk_index INTEGER,
  page_number INTEGER,
  char_offset INTEGER,
  char_length INTEGER
)

notes(
  id TEXT PRIMARY KEY,
  document_id TEXT → documents.id,  -- UNIQUE
  content TEXT,
  word_count INTEGER,
  created_at TEXT,
  updated_at TEXT
)

flashcards(
  id TEXT PRIMARY KEY,
  document_id TEXT → documents.id,
  front TEXT,
  back TEXT,
  card_type TEXT DEFAULT 'basic',
  difficulty INTEGER DEFAULT 3,
  tags TEXT DEFAULT '[]',
  created_at TEXT
)

quiz_questions(
  id TEXT PRIMARY KEY,
  document_id TEXT → documents.id,
  question TEXT,
  options TEXT DEFAULT '[]',  -- JSON array
  correct_answer_index INTEGER,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  created_at TEXT
)

chat_sessions(
  id TEXT PRIMARY KEY,
  document_id TEXT → documents.id,
  title TEXT DEFAULT 'New Chat',
  messages TEXT DEFAULT '[]',  -- JSON blob
  created_at TEXT,
  updated_at TEXT
)
```

**Notes:**
- `check_same_thread=False` for WAL mode concurrent reads
- `journal_mode=WAL` for non-blocking reads during writes
- All IDs are UUID4 strings
- `chat_sessions.messages` stores the entire message array as a JSON blob — not normalised
- No full-text search index (FTS5) — semantic search uses FAISS instead

**Performance:** For the expected document count (<100), SQLite performs perfectly. No N+1 queries observed. All operations are single queries.

---

### `pipeline/processor.py` — Master Orchestrator

The pipeline runs synchronously in one call to `process_document_sync()`:

```
Stage 0: Create DB record (status=processing)
Stage 1: Extract text (PDF/DOCX/PPTX/EPUB/Image routing)
Stage 2: OCR (if image or image-heavy PDF)
Stage 3: Generate Markdown (heading detection, bullet extraction)
Stage 4: Chunk text (1000-char, 200-char overlap)
Stage 5: Generate embeddings (sentence-transformers)
Stage 6: Save chunks + vectors to FAISS + SQLite
Stage 7: Generate flashcards (rule-based definition extraction)
Stage 8: Generate quiz questions (MCQ with distractors)
Stage 9: Status = processed/ready
```

**Progress reporting:** Uses a `progress_callback(stage, progress)` function that is called but NOT sent back to the frontend in real-time. The Tauri IPC is synchronous — progress updates are lost because the Python process doesn't produce output until the call returns.

**This is a significant architectural gap.** The `ProcessingModal` shows stages, but the progress it displays is based on polling that never updates during processing. The user sees 0% → 100% jump.

**Fix options:**
1. Use Tauri events (emit_to_window) from Rust during processing — requires Tauri event system
2. Split `process_document` into multiple calls (one per stage)
3. Run pipeline in a background thread + poll via `get_document_status` IPC

---

### `pipeline/pdf_extractor.py` — PDF Text Extraction

Uses PyMuPDF (fitz):
- Per-page text extraction with `page.get_text("text")`
- Image detection: `page.get_images()`
- Cleans null bytes, collapses whitespace
- Returns `ExtractionResult` dataclass with `pages`, `full_text`, `has_images`

**Performance:** PyMuPDF is C-based, very fast. A 44-page PDF processes in <2 seconds.

---

### `pipeline/ocr.py` — OCR Pipeline

Two-engine priority chain:
1. **RapidOCR** (ONNX): Python-native, no system dependency, fast CPU inference
2. **Tesseract CLI**: System-level fallback, `subprocess.run(['tesseract', ...])`, 60s timeout

For PDF OCR: Uses PyMuPDF to render page as PNG at 200 DPI → then runs image OCR.

**Confidence:** RapidOCR returns per-item confidence. Tesseract returns fixed 0.8.

**Issue:** OCR is only triggered if `has_images=True` AND text extraction returned empty. Pure text PDFs skip OCR correctly.

---

### `pipeline/markdown_generator.py` — Markdown Generation

Rule-based (no LLM required):
- Detects headings by line length/capitalization heuristics
- Extracts bullet points from indented/marked lines
- Generates a structured document with `#`, `##`, `###` hierarchy
- Includes Summary, Key Concepts, and Highlights sections

**Quality:** Good for structured PDFs. Poor for scanned documents or PDFs with complex layouts. LLM-based markdown generation would be significantly better but requires model to be loaded.

---

### `pipeline/content_generator.py` — Flashcards & Quiz

#### Flashcards
- **Definition extraction:** Finds sentences matching `"X is Y"`, `"X: Y"`, `"X – Y"` patterns
- **Named entity extraction:** Dates, proper nouns used as card fronts
- **Fill-in-the-blank:** Creates cloze cards from key sentences
- Max 20 cards per document

**Quality:** Adequate for factual content. No semantic understanding — "What is the OCR engine?" quality cards.

#### Quiz
- **MCQ generation:** From definition sentences, creates 4-choice questions
- **Distractor generation:** Other definition terms used as wrong answers
- Max 10 questions per document

**Quality:** Functional. Distractors are plausible if document has multiple definitions.

---

### `pipeline/structure_generator.py` — Timeline & Mind Map

#### Timeline
- Regex-based year/decade/month+year extraction
- Max 20 events, sorted chronologically
- Sentences with dates become timeline events
- **Works well** for historical documents; returns empty for non-historical content

#### Mind Map
- Heading hierarchy (`#`, `##`, `###`) → topic/subtopic tree
- Fallback to sentence extraction if no headings
- Max depth 3, max 4 subtopics, max 4 children each

#### Mermaid Diagram
- Converts mind map tree → `flowchart LR` syntax
- Escaped labels (handles `"` and newlines)
- **Verified working:** Generates valid Mermaid syntax

---

### `ai/embeddings.py` — Sentence Transformers

Model: `all-MiniLM-L6-v2` (80MB, 384-dimensional)

```python
class EmbedderState:
    model_name = "all-MiniLM-L6-v2"
    model: SentenceTransformer | None  # Singleton
    
def get_embedder() → EmbedderState   # Thread-safe singleton
def embed_one(text) → list[float]    # Single embedding
def embed_batch(texts) → np.array   # Batch embeddings (faster)
```

**Performance test result:**
- Load time: ~60 seconds (sentence-transformers warm-up)
- After load: instant (cached singleton)
- Embedding dimension: 384
- Model is CPU-only, runs on all hardware

**Memory:** ~500MB RAM when loaded

---

### `ai/vector_search.py` — FAISS Vector Index

```python
class VectorStore:
    index: faiss.IndexFlatIP  # Inner product (cosine after L2-norm)
    id_map: dict[int, str]    # FAISS int → chunk UUID
    store_path: Path          # ~/.khoji/vectors/
    _lock: threading.Lock     # Thread-safe modification
```

- Persisted to disk as `index.faiss` + `metadata.pkl`
- L2-normalized before insert → inner product = cosine similarity
- Search returns top-k chunks with scores
- **Verified:** 63 vectors indexed, search is instantaneous

---

### `ai/llm.py` — Local LLM Inference

Uses `llama-cpp-python` for GGUF model inference:

```python
class LocalLLM:
    model_path: Path
    n_ctx: int = 4096
    n_threads: int  # auto-detected from CPU cores
    use_gpu: bool   # checks for Metal/CUDA/Vulkan
    
def chat(messages, max_tokens=512) → str  # Returns full response
```

**Hardware detection:**
- Auto-detects GPU (Metal on Apple, CUDA on NVIDIA, Vulkan on compatible)
- Falls back to CPU inference (i5 12th Gen: ~5-15 tokens/second)
- Uses all available CPU cores (`os.cpu_count()`)

**Available models:**
- `qwen2.5-0.5b-instruct-q8_0.gguf` (469MB) — fastest
- `qwen2.5-1.5b-instruct-q4_k_m.gguf` (591MB) — better quality
- `LLM (900 MB)` — not downloaded

**Chat format:**
- Uses Qwen's `<|im_start|>` / `<|im_end|>` chat template
- System prompt includes document context chunks
- Response is full text (not streaming)

---

## Backend Issues & Gaps

| ID | Module | Issue | Severity |
|---|---|---|---|
| B-01 | `main.py` | `download_model` is a stub — no actual download | High |
| B-02 | `processor.py` | Progress callbacks not sent to frontend in real-time | High |
| B-03 | `processor.py` | No cancellation support for long pipeline runs | Medium |
| B-04 | `main.py` | Single-threaded — one request blocks all others | Medium |
| B-05 | `llm.py` | First chat request triggers 10-30s model load with no feedback | High |
| B-06 | `db.py` | `delete_document` doesn't remove from FAISS index | High |
| B-07 | `chat_sessions` | Sessions stored in DB but not loaded on app startup | Medium |
| B-08 | `embeddings.py` | No HF_TOKEN → rate-limited model downloads | Low |
| B-09 | `markdown_generator.py` | No LLM summarization — rule-based only | Low |
| B-10 | `exporter.py` | HTML export has inline style with hardcoded colors (`#1a1a2e`) | Low |
