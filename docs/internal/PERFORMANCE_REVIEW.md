# Performance Review

## Overview

This document analyzes Khoji's performance characteristics across all layers, identifies bottlenecks, and suggests optimizations.

## Startup Performance

### Cold Start (First Launch)

| Phase | Time | Notes |
|-------|------|-------|
| Tauri binary init | ~100ms | Rust startup |
| Python process spawn | ~200ms | Process creation |
| Python import | ~500ms | Deferred imports help |
| Engine handshake | ~100ms | Ready signal |
| Embedding model load | 2-3 sec | Background thread, doesn't block UI |
| React app load | ~200ms | Vite bundle |
| First data fetch | ~100ms | get_documents IPC |
| **Total (UI visible)** | **~1 sec** | Before embedding model ready |

**Optimization**: Embedding model loads in background. UI is responsive before model is ready. First search may be slow if model isn't loaded yet.

### Warm Start (Subsequent Launches)

| Phase | Time |
|-------|------|
| Tauri binary init | ~100ms |
| Python process spawn | ~200ms |
| Python import | ~500ms |
| Engine handshake | ~100ms |
| React app load | ~200ms |
| **Total** | **~1 sec** |

**Note**: Embedding model is NOT cached between launches. It reloads from disk each time. Sentence-transformers caches the model in `~/.cache/huggingface/`, so disk I/O is fast.

## Document Processing Performance

### Pipeline Stages

| Stage | Time (10-page PDF) | Time (50-page PDF) | Bottleneck |
|-------|-------------------|-------------------|------------|
| File validation | <1ms | <1ms | Rust path canonicalize |
| PDF extraction | ~100ms | ~500ms | PyMuPDF I/O |
| Markdown generation | ~50ms | ~200ms | Text processing |
| Chunking | ~10ms | ~50ms | String operations |
| Embedding | ~200ms | ~1s | sentence-transformers |
| Flashcard generation | ~50ms | ~100ms | Rule-based, fast |
| Quiz generation | ~50ms | ~100ms | Rule-based, fast |
| DB writes | ~50ms | ~100ms | SQLite INSERT |
| FAISS save | ~10ms | ~50ms | Index serialization |
| **Total** | **~500ms** | **~2s** | |

**Key insight**: Embedding is the slowest stage but still fast for typical documents. The pipeline is synchronous — no parallelism between stages.

### OCR Performance

| Scenario | Time | Notes |
|----------|------|-------|
| PDF with text | 0ms | OCR skipped |
| Scanned PDF (10 pages) | 30-60 sec | 3-6 sec per page |
| Image (1 page) | 2-5 sec | Depends on resolution |

**OCR is the biggest performance bottleneck** when triggered. RapidOCR is faster than Tesseract but still slow for multi-page scans.

## Search Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Query embedding | ~50ms | Single sentence |
| FAISS search (1K vectors) | <1ms | Brute-force, fast |
| FAISS search (10K vectors) | <10ms | Still fast |
| FAISS search (100K vectors) | ~50ms | Starting to notice |
| DB enrichment | ~5ms | 10 chunks × simple query |
| **Total** | **~60ms** | Excellent |

**FAISS IndexFlatIP** is brute-force O(n) but performs well for typical use (thousands of documents, tens of thousands of chunks). At 100K+ vectors, an HNSW index would be better.

## LLM Performance

| Model | Load Time | Generate (100 tokens) | Generate (500 tokens) |
|-------|-----------|----------------------|----------------------|
| qwen2.5-0.5b | 5-10 sec | 1-3 sec | 5-10 sec |
| qwen2.5-1.5b | 10-15 sec | 3-8 sec | 15-30 sec |
| smollm2-1.7b | 10-15 sec | 3-8 sec | 15-30 sec |
| tinyllama-1.1b | 8-12 sec | 2-5 sec | 10-20 sec |

**CPU-only**: `n_threads = cpu_count - 2`. No GPU acceleration.

**First generation** after load is slower (model initialization). Subsequent generations are faster.

**Weakness**: No streaming to frontend despite `generate_stream()` existing in Python. The entire response is buffered before sending.

## Memory Usage

### Steady State

| Component | RAM | Notes |
|-----------|-----|-------|
| OS + Desktop | ~2 GB | Varies by distro |
| Tauri/WebView | ~300 MB | Chromium rendering |
| Python base | ~100 MB | Interpreter |
| Embedding model | ~80 MB | all-MiniLM-L6-v2 |
| FAISS index | ~15 MB | 10K vectors |
| SQLite | ~10 MB | Database + WAL |
| **Subtotal** | **~2.5 GB** | Without LLM |

### With LLM Loaded

| Model | Additional RAM | Total |
|-------|---------------|-------|
| qwen2.5-0.5b | ~500 MB | ~3 GB |
| qwen2.5-1.5b | ~1200 MB | ~3.7 GB |
| smollm2-1.7b | ~1400 MB | ~3.9 GB |
| tinyllama-1.1b | ~900 MB | ~3.4 GB |

### Memory Pressure Scenarios

| System RAM | Available | Can Run |
|-----------|-----------|---------|
| 4 GB | ~1.5 GB | UI only (no LLM comfortably) |
| 8 GB | ~5.5 GB | 0.5B model (tight) |
| 12 GB | ~9.5 GB | 0.5B + 1.5B |
| 16 GB | ~13.5 GB | All models |

**Weakness**: No memory monitoring or automatic model unloading. If the system runs low on memory, the app may OOM.

## Concurrency Bottleneck

### Mutex<Child> Serialization

All 18 Tauri commands serialize through a single `Mutex<Child>`:
```
Command A (process_document, 2 sec) → Command B (search, 50ms) → Command C (chat, 3 sec)
```
Total time: 5 seconds. Without serialization: 3 seconds (Command B runs in parallel).

**Impact**: Long-running operations (document processing, LLM generation) block all other commands. The frontend appears frozen during these operations.

### No Streaming

Despite Python supporting `generate_stream()`, all IPC is synchronous request/response:
1. Send full request
2. Wait for full response
3. Return to frontend

The frontend must poll `get_processing_progress` for status updates during long operations.

## Database Performance

| Operation | Time | Notes |
|-----------|------|-------|
| INSERT (single row) | <1ms | SQLite fast for single writes |
| INSERT (100 rows) | ~10ms | Batch insert |
| SELECT (by ID) | <1ms | Primary key lookup |
| SELECT (all docs) | <5ms | Small dataset |
| DELETE (cascade) | ~5ms | 5 tables × single row |
| WAL checkpoint | ~10ms | Background |

**SQLite performance is excellent** for this use case. WAL mode prevents read blocking during writes.

## Vector Store Performance

| Operation | Time (10K vectors) | Notes |
|-----------|-------------------|-------|
| add_vectors (100) | ~50ms | Including save |
| search (k=10) | <10ms | Brute-force |
| remove_document (1 doc) | ~200ms | Full rebuild |
| save (full index) | ~50ms | Binary + JSON |

**Weakness**: `remove_document()` rebuilds the entire index from scratch. For large indices, this is expensive. Could use FAISS's `remove_ids()` method instead.

## Identified Bottlenecks

### 1. Mutex Serialization (High Impact)
**Problem**: All commands block on Python process.
**Impact**: UI freezes during long operations.
**Solution**: Implement streaming IPC or background task queue.

### 2. No LLM Streaming (Medium Impact)
**Problem**: Entire LLM response buffered before sending.
**Impact**: 3-30 second wait with no feedback.
**Solution**: Implement SSE or chunked response streaming.

### 3. OCR Performance (High Impact, Rare)
**Problem**: Scanned PDFs take 30+ seconds per 10 pages.
**Impact**: User waits with no progress feedback.
**Solution**: Show per-page progress, consider async processing.

### 4. FAISS Full Rebuild on Delete (Low Impact)
**Problem**: Removing one document rebuilds entire index.
**Impact**: Noticeable at 100K+ vectors.
**Solution**: Use FAISS `remove_ids()` or lazy deletion.

### 5. No Memory Management (Medium Impact)
**Problem**: No automatic model unloading under memory pressure.
**Impact**: Potential OOM on low-RAM systems.
**Solution**: Monitor memory, unload models when needed.

### 6. Startup Model Reload (Low Impact)
**Problem**: Embedding model reloads from disk every launch.
**Impact**: 2-3 second startup delay.
**Solution**: Consider model caching or keeping engine alive between sessions.

## Optimization Opportunities

### Quick Wins
1. **Batch DB inserts**: Use `executemany()` for chunk inserts
2. **Lazy FAISS save**: Only save on explicit request, not every mutation
3. **Model caching**: Keep Python engine alive between launches
4. **Progress streaming**: Send real-time progress via SSE

### Medium Effort
1. **Streaming IPC**: Implement chunked JSON responses
2. **Background processing**: Move document processing to background thread
3. **Memory monitoring**: Add psutil-based memory tracking
4. **FAISS optimization**: Use `remove_ids()` instead of full rebuild

### Major Effort
1. **GPU acceleration**: Support CUDA/Metal for LLM inference
2. **Vector index upgrade**: Move from FlatIP to HNSW for large datasets
3. **Multi-process architecture**: Separate Python workers for parallel processing
4. **Incremental embedding**: Add vectors without full save
