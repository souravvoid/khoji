# 05 — AI Pipeline Analysis

> Complete data flow from raw document bytes to structured knowledge.

---

## Overview

The AI pipeline has two phases:

1. **Ingestion** — Document → structured data in SQLite + FAISS (run once per document)
2. **Query** — User query → relevant chunks → LLM → response (run per chat message)

Both phases can operate without any internet connection, using only locally-loaded models.

---

## Phase 1: Ingestion Pipeline

### Trigger
User drops a file → Tauri file dialog → `process_document` IPC call → Python handles the rest.

### Step-by-Step Data Flow

```
Input: file_path (e.g. /home/user/Documents/paper.pdf)
       
┌─────────────────────────────────────────────────┐
│ STEP 1: Document Registration                    │
│                                                   │
│  db.create_document({                            │
│    id: uuid4(),                                  │
│    filename: "paper.pdf",                        │
│    status: "processing"                          │
│  })                                              │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 2: Text Extraction                          │
│                                                   │
│  Route by file extension:                        │
│  .pdf  → pdf_extractor.extract_pdf()             │
│  .docx → docx_extractor.extract_docx()          │
│  .pptx → pptx_extractor.extract_pptx()          │
│  .epub → epub_extractor.extract_epub()          │
│  .png/.jpg/.jpeg → ocr.ocr_image()              │
│                                                   │
│  Output: ExtractionResult {                      │
│    pages: [ExtractedPage(number, text, offset)], │
│    full_text: str,                               │
│    has_images: bool,                             │
│    page_count: int                               │
│  }                                               │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 3: OCR (conditional)                        │
│                                                   │
│  Triggered when:                                 │
│  - File is an image (PNG/JPG)                    │
│  - PDF has images AND text extraction is empty   │
│                                                   │
│  Engine priority:                                │
│  1. RapidOCR (ONNX runtime, CPU)                │
│  2. Tesseract CLI (subprocess, 60s timeout)      │
│                                                   │
│  For PDFs: PyMuPDF renders page → 200 DPI PNG    │
│  → OCR → tmp file cleanup                        │
│                                                   │
│  Output: OcrResult { text, confidence, engine }  │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 4: Markdown Generation (rule-based)         │
│                                                   │
│  Input: full_text (combined pages)               │
│                                                   │
│  Algorithm:                                      │
│  1. Detect headings (capitalized lines, short    │
│     lines, lines followed by body text)          │
│  2. Extract bullet points (-, *, numbered)       │
│  3. Extract key sentences (first/last of para)  │
│  4. Build structured Markdown:                   │
│     - # Document Title                           │
│     - ## Summary (first paragraph)               │
│     - ## Key Concepts (definition sentences)     │
│     - ## [Each detected heading]                 │
│     - ## Highlights (significant sentences)      │
│                                                   │
│  Output: markdown_text (str)                     │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 5: Text Chunking                            │
│                                                   │
│  Input: full_text                                │
│                                                   │
│  Algorithm: sliding window                       │
│  - chunk_size: 1000 characters                   │
│  - overlap: 200 characters                       │
│  - Splits on word boundaries (not mid-word)      │
│                                                   │
│  Output: list[Chunk {                            │
│    content: str,                                 │
│    chunk_index: int,                             │
│    page_number: int (approximated)               │
│  }]                                              │
│                                                   │
│  44-page PDF → ~44 chunks (1000 chars each)     │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 6: Embedding Generation                     │
│                                                   │
│  Model: all-MiniLM-L6-v2 (80MB, 384-dim)       │
│  Framework: sentence-transformers                │
│  Device: CPU (auto-detects GPU if available)     │
│                                                   │
│  Batch processing: all chunks embedded together  │
│  L2-normalization applied for cosine similarity  │
│                                                   │
│  For 44 chunks: ~2-5 seconds on i5 12th Gen     │
│                                                   │
│  Output: numpy array (n_chunks × 384 floats)    │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 7: Vector Store Update                      │
│                                                   │
│  FAISS IndexFlatIP (inner product after L2-norm) │
│  Thread-safe with threading.Lock                 │
│                                                   │
│  - Add vectors to FAISS index                    │
│  - Map FAISS int IDs → chunk UUIDs              │
│  - Persist: index.faiss + metadata.pkl           │
│    → ~/.khoji/vectors/                           │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 8: Database Writes                          │
│                                                   │
│  - db.save_chunks(doc_id, chunks)                │
│  - db.save_notes(doc_id, markdown_text)         │
│  - db.save_flashcards(doc_id, cards)            │
│  - db.save_quiz_questions(doc_id, questions)    │
│  - db.update_document(doc_id, {                  │
│      status: "processed",                        │
│      page_count: N                               │
│    })                                            │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 9: Content Generation                       │
│                                                   │
│  Flashcard generation (rule-based):              │
│  - Pattern: "X is/are/means Y" → card           │
│  - Pattern: "X: Y" definitions → card           │
│  - Fill-in-blank from key sentences             │
│  - Max 20 cards                                  │
│                                                   │
│  Quiz generation (rule-based):                   │
│  - "What is X?" from definition sentences       │
│  - Fill-in-blank (year, name) MCQ               │
│  - Distractors: other terms from document        │
│  - Max 10 questions, 4 options each             │
└─────────────────────────────────────────────────┘
```

---

## Phase 2: Query Pipeline (AI Chat)

### Trigger
User types message in ChatPanel → `chat` IPC call

```
Input: message (str), doc_id (str), session_id (str)

┌─────────────────────────────────────────────────┐
│ STEP 1: Retrieve Relevant Chunks                 │
│                                                   │
│  1. Embed user query with same model:            │
│     embed_one(message) → 384-dim vector          │
│                                                   │
│  2. FAISS search:                                │
│     index.search(query_vector, k=5)              │
│     → top-5 chunks by cosine similarity          │
│                                                   │
│  3. Optionally filter by doc_id                  │
│     (chunks include document_id in metadata)     │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 2: Build Prompt                             │
│                                                   │
│  System prompt:                                  │
│  "You are Khoji, an AI assistant. Answer         │
│   based on the following document context:       │
│   [chunk1]\n[chunk2]\n...[chunk5]"              │
│                                                   │
│  Messages: entire session history                │
│  + new user message                              │
└────────────────────────┬────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│ STEP 3: LLM Inference                            │
│                                                   │
│  Model: Qwen 2.5 (0.5B or 1.5B GGUF)           │
│  Runtime: llama-cpp-python                       │
│  Context: 4096 tokens                            │
│  Max response: 512 tokens                        │
│  Temperature: 0.7 (default)                      │
│                                                   │
│  On first call: model loads from disk (~10-30s) │
│  Subsequent calls: warm inference (~5-15 t/s)   │
│                                                   │
│  Output: full response string (not streamed)    │
└─────────────────────────────────────────────────┘
```

---

## Semantic Search Pipeline

### Trigger
User types in SearchModal → calls `search_documents` IPC

```
Input: query (str), limit (int, default 10)

STEP 1: embed_one(query) → 384-dim vector
STEP 2: FAISS search(vector, k=limit) → [(score, chunk_id)]
STEP 3: db.get_chunk(chunk_id) for each result
STEP 4: Group by document_id
STEP 5: Return [{doc_id, chunk, score, page_number}]
```

**Current gap:** The SearchModal in the frontend does NOT call `search_documents`. It only does a client-side `documents.filter(d => d.title.includes(query))`. This means the FAISS semantic search is fully wired on the backend but unused in the frontend.

---

## OCR Pipeline Details

```
Image input (PNG/JPG/JPEG, or PDF page rendered to PNG)
         │
         ▼
Try RapidOCR (rapidocr-onnxruntime):
  - Loads ONNX model (first call)
  - Returns: [[bbox, text, confidence], ...]
  - Average confidence tracked
  - Returns OcrResult(text, confidence, engine="rapidocr")
         │
         ▼ (if RapidOCR unavailable or fails)
Try Tesseract CLI:
  - Checks PATH for 'tesseract' binary
  - Runs: tesseract input.png stdout --psm 6
  - Timeout: 60 seconds
  - Fixed confidence: 0.8
  - Returns OcrResult(text, confidence, engine="tesseract")
         │
         ▼ (if both fail)
OcrResult(text="", confidence=0.0, engine="none")
```

**System test:** Tesseract is installed (`tesseract 5.5.0`). RapidOCR is installed.

---

## Extraction Performance (Verified)

| Document | Pages | Text Length | Chunks | Flashcards | Quiz |
|---|---|---|---|---|---|
| Algo Lab Manual.pdf | ~40+ | ~35,000 chars | 44 | 20 | 10 |
| filesdroppbl.pdf | ~8 | ~8,000 chars | 8 | 20 | 10 |
| test-khoji | 1 | ~400 chars | 1 | 0 | 0 |

---

## Model Performance Expectations

| Model | Size | RAM | Speed (i5 12th Gen CPU) | Quality |
|---|---|---|---|---|
| all-MiniLM-L6-v2 | 80MB | ~500MB | <1s per batch (after load) | 8/10 |
| Qwen 2.5 0.5B Q8 | 469MB | ~700MB | ~8-12 tokens/sec | 6/10 |
| Qwen 2.5 1.5B Q4 | 591MB | ~900MB | ~4-6 tokens/sec | 7/10 |

**Total RAM at peak:** ~1.8GB (OS) + 500MB (embeddings) + 900MB (LLM 1.5B) ≈ 3.2GB  
**Within 8GB RAM budget with comfortable margin.**

---

## Pipeline Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| No real-time progress | User sees no feedback during 1-5 min processing | Polling via `get_document` status |
| Rule-based markdown | Poor for scanned/complex layout docs | LLM-based summarization (future) |
| No streaming LLM output | Chat feels slow (30s wait for response) | Tauri events for streaming |
| No session persistence | Chat history lost on restart | Already in DB schema, needs frontend wiring |
| Single-threaded IPC | One chat blocks all other commands | Python asyncio or thread pool |
| Model warm-up | First chat: 10-30s with no feedback | Pre-load model at engine startup |
| FAISS no deletion | Removing a document doesn't remove its vectors | Rebuild index on deletion |

---

## What Works Excellently (Verified by Tests)

1. **PDF text extraction** — PyMuPDF is fast and accurate ✅
2. **Embedding generation** — all-MiniLM-L6-v2 correct 384-dim output ✅
3. **FAISS search** — instantaneous, correct results ✅
4. **Timeline extraction** — regex-based date finding works correctly ✅
5. **Mind map generation** — heading hierarchy extraction correct ✅
6. **Mermaid generation** — valid flowchart LR syntax produced ✅
7. **Flashcard generation** — definition-based card creation works ✅
8. **Quiz generation** — MCQ with 4 options generated ✅
9. **All export formats** — Markdown, HTML, JSON, Anki TSV, Mermaid ✅
10. **Database CRUD** — all operations verified working ✅
