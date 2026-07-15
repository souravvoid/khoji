# Backend Analysis

## Overview

The Python backend (`backend/python/khoji_engine`) is the **brain** of Khoji. It handles all document processing, AI inference, content generation, and data persistence. It communicates with the Rust/Tauri frontend via newline-delimited JSON over stdin/stdout.

## Package Structure

```
khoji_engine/
├── __init__.py              # Empty
├── main.py                  # Entry point, IPC loop
├── handlers.py              # Action dispatch table (20 handlers)
├── ai/
│   ├── __init__.py          # Empty
│   ├── embeddings.py        # Sentence-transformer embeddings
│   ├── llm.py               # llama-cpp-python wrapper
│   └── vector_search.py     # FAISS vector store
├── database/
│   ├── __init__.py          # Empty
│   └── db.py                # SQLite (7 tables, all CRUD)
└── pipeline/
    ├── __init__.py          # Empty
    ├── processor.py         # Pipeline orchestrator
    ├── pdf_extractor.py     # PyMuPDF extraction
    ├── docx_extractor.py    # python-docx extraction
    ├── pptx_extractor.py    # python-pptx extraction
    ├── epub_extractor.py    # EbookLib extraction
    ├── ocr.py               # RapidOCR / Tesseract fallback
    ├── markdown_generator.py # Structured markdown + chunking
    ├── content_generator.py # Flashcards, quizzes (rule-based)
    ├── structure_generator.py # Timelines, mind maps
    └── exporter.py          # 8 export formats
```

## IPC Protocol

### Wire Format

```
Frontend → Rust:     invoke('command', { payload })
Rust → Python:       {"action":"command_name","payload":{...}}\n
Python → Rust:       {"status":"ok","result":{...}}\n
                     {"status":"error","error":"message"}\n
Rust → Frontend:     Result<String, String>
```

### Startup Handshake

1. Python spawns, loads embedding model in background thread
2. Python writes: `{"type":"ready","version":"1.0.0"}\n`
3. Rust reads first line, confirms engine is alive
4. Rust proceeds with Tauri app initialization

### Error Handling

- All exceptions caught in `main.py` main loop
- Returns `{"status":"error","error":"str(e)"}` — never crashes
- Traceback logged to stderr (not stdout)
- JSON decode errors also return error responses

## All 20 Handler Actions

| # | Action | Handler | Description |
|---|--------|---------|-------------|
| 1 | `ping` | `handle_ping` | Health check → "pong" |
| 2 | `process_document` | `handle_process_document` | Full pipeline: extract → embed → generate |
| 3 | `search` | `handle_search` | Semantic search via FAISS |
| 4 | `generate_flashcards` | `handle_generate_flashcards` | Rule-based flashcard extraction |
| 5 | `generate_quiz` | `handle_generate_quiz` | Rule-based MCQ generation |
| 6 | `get_documents` | `handle_get_documents` | List all documents |
| 7 | `get_document` | `handle_get_document` | Single doc with nested data |
| 8 | `delete_document` | `handle_delete_document` | Remove doc + vectors + cascade |
| 9 | `export_document` | `handle_export_document` | Export to 8 formats |
| 10 | `get_models` | `handle_get_models` | List available LLM models |
| 11 | `chat` | `handle_chat` | RAG-powered Q&A |
| 12 | `get_chat_history` | `handle_get_chat_history` | List chat sessions |
| 13 | `download_model` | `handle_download_model` | Download GGUF model file |
| 14 | `check_processing_status` | `handle_check_processing_status` | Document status string |
| 15 | `get_processing_progress` | `handle_get_processing_progress` | Status → 0/50/100 progress |
| 16 | `generate_timeline` | `handle_generate_timeline` | Extract date events |
| 17 | `generate_mindmap` | `handle_generate_mindmap` | Generate Mermaid diagram |
| 18 | `save_notes` | `handle_save_notes` | Upsert notes content |
| 19 | `save_chat_session` | `handle_save_chat_session` | Save chat session + messages |
| 20 | `select_model` | `handle_select_model` | Switch active LLM model |

**Note**: All imports are **deferred** inside each handler for fast startup. This means importing `handlers.py` doesn't load PyMuPDF, sentence-transformers, or other heavy dependencies.

## Document Processing Pipeline

### `processor.py` — The Orchestrator

```
process_document_sync(file_path: Path) → ProcessingResult
│
├── 1. Dedup check (file_path in DB?)
│   └── Yes → return existing doc_id
│
├── 2. Extract text
│   ├── .pdf  → pdf_extractor.extract_pdf()
│   ├── .docx → docx_extractor.extract_docx()
│   ├── .pptx → pptx_extractor.extract_pptx()
│   ├── .epub → epub_extractor.extract_epub()
│   ├── .png/.jpg/.jpeg → ocr.ocr_image()
│   └── OCR fallback (empty text + OCR available)
│       └── Render pages → 200 DPI PNG → OCR each
│
├── 3. Create DB record
│
├── 4. Generate markdown
│   └── Structured markdown with metadata block
│
├── 5. Chunk markdown
│   └── 1000 chars, 200 overlap, sentence boundaries
│
├── 6. Embed chunks
│   └── Encode all → FAISS add
│
├── 7. Generate study materials
│   ├── Flashcards (rule-based, max 20)
│   └── Quiz questions (rule-based, max 10)
│
└── 8. Finalize
    └── Status → "ready"
```

### Progress Callbacks

```python
("ocr", 10)        # OCR phase complete
("extract", 30)    # Text extraction complete
("markdown", 40)   # Markdown generation complete
("chunking", 55)   # Chunking complete
("embedding", 70)  # Embedding complete
("flashcards", 85) # Flashcard generation complete
("quiz", 92)       # Quiz generation complete
("complete", 100)  # All done
```

**Weakness**: Progress callbacks are defined but NOT sent to the frontend. The frontend polls `get_processing_progress` which returns a static 0/50/100 mapping.

### Extractors

| Extractor | Library | Input | Output |
|-----------|---------|-------|--------|
| PDF | PyMuPDF (fitz) | .pdf | Pages with text |
| DOCX | python-docx | .docx | Paragraphs (page breaks = pages) |
| PPTX | python-pptx | .pptx | Slides (one "page" per slide) |
| EPUB | EbookLib + HTMLParser | .epub | HTML documents (one "page" each) |
| OCR | RapidOCR → Tesseract | Images | Text with confidence |

**OCR Fallback Chain**: If text extraction returns empty and OCR is available, PDF pages are rendered to 200 DPI PNG images and OCR'd. This handles scanned PDFs.

## Database Layer (`database/db.py`)

### 7 Tables

1. **documents** — Document metadata (id, filename, path, size, pages, status)
2. **document_chunks** — Text chunks with positions (for search results)
3. **notes** — One-to-one with documents (markdown content)
4. **flashcards** — SRS flashcards with SM-2 fields
5. **quiz_questions** — MCQ questions with options
6. **chat_sessions** — Chat session metadata
7. **chat_messages** — Individual chat messages

### Key Patterns

- **SQLite WAL mode**: Concurrent reads, single writer
- **UUID primary keys**: All IDs are UUIDs
- **ISO timestamps**: All timestamps are UTC ISO 8601
- **Cascade deletes**: Deleting a document removes all related data
- **No migrations**: Schema uses `CREATE TABLE IF NOT EXISTS` on every init

### Notable Functions

- `update_flashcard_review()`: Implements SM-2 spaced repetition algorithm
- `get_due_flashcards()`: Returns cards where `next_review_at <= now`
- `save_chat_session()`: Delete-and-reinsert pattern for messages
- `search_chunks()`: SQL LIKE search (unused — all search goes through FAISS)

## Content Generation

### Flashcards (`content_generator.py`)

Rule-based extraction from document text:

1. **Definition detection**: `X is Y` → "What is X?" / Y
2. **Fact detection**: Sentences with numbers → card with source reference
3. **Context pairing**: Consecutive sentences as context cards (fallback)
4. Shuffled, capped at 20 cards

### Quizzes (`content_generator.py`)

Rule-based MCQ generation:

1. **Definition MCQ**: Term as question, definition as answer, 3 distractors
2. **Fact fill-in-blank**: Number replaced by `___`, distractors as `±{5,2,3,7}`
3. Shuffled, capped at 10 questions

### Timelines (`structure_generator.py`)

Regex-based date extraction:

1. Match years (19xx, 20xx), month+year, decades
2. Create `{date, title, description}` events
3. Sort chronologically, cap at 20 events

### Mind Maps (`structure_generator.py`)

Heading-based structure extraction:

1. `#` → central topic
2. `##` → branches (max 4)
3. `###` / definitions / bullets → leaves (max 4 per branch)
4. Convert to Mermaid flowchart syntax

## Export System (`exporter.py`)

8 formats via `FORMAT_HANDLERS` dict:

| Format | Filename | Content |
|--------|----------|---------|
| `markdown` | `notes.md` | Raw notes |
| `html` | `document.html` | Styled HTML with all content |
| `json` | `document.json` | Complete document data |
| `anki` | `flashcards.txt` | Tab-separated (Anki import) |
| `quiz_json` | `quiz.json` | Quiz questions |
| `flashcards_json` | `flashcards.json` | Flashcard data |
| `mermaid` | `diagram.mmd` | Mermaid flowchart |
| `csv` | `library.csv` | All documents metadata |

**Security**: CSV export sanitizes cells starting with `=`, `+`, `-`, `@` to prevent formula injection.

## Error Handling Patterns

1. **Main loop**: Catches all exceptions, returns error JSON, never crashes
2. **Handler dispatch**: Wraps each handler in try/except, logs traceback
3. **Deferred imports**: ImportError propagates as handler error
4. **Extractor errors**: Appended to `result.errors` list, partial results returned
5. **OCR fallback**: Chain of engines, returns empty on total failure
6. **Embedding failures**: Caught and logged, processing continues without vectors
7. **Vector store**: Load failures create fresh empty index; save failures preserve in-memory state
8. **LLM errors**: Return error strings, never raise

## Dependencies

### Core
- `PyMuPDF>=1.25` — PDF extraction
- `numpy>=2.0` — Array operations
- `sentence-transformers>=3.0` — Embeddings
- `faiss-cpu>=1.9` — Vector search
- `llama-cpp-python>=0.3` — Local LLM
- `python-docx>=1.1` — DOCX extraction
- `python-pptx>=1.0` — PPTX extraction
- `EbookLib>=0.18` — EPUB extraction
- `torch` — PyTorch (CPU-only from pytorch.org)

### Optional
- `rapidocr-onnxruntime>=1.0` — OCR
- `pytest>=8.0` — Testing
- `ruff>=0.8` — Linting

### Package Manager
- `uv` (Astral) — Fast Python package manager
- PyTorch installed from CPU-only index (`download.pytorch.org/whl/cpu`)
