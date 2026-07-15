# Performance Report — Khoji v1.0.0

Measured against the **target judging hardware**: Intel Core i5, 8 GB RAM, integrated Intel GPU, Fedora (Linux).

> Caveat: Live metrics below marked `[~]` are **estimates/static** from code review + `docs/internal/PERFORMANCE_REVIEW.md`. They were **not** captured on the target hardware in this audit because the embedding/LLM models were not pre-staged in the CI environment. For a real number set, run `LOCAL_AI_VERIFICATION.md` with pre-cached models. The earlier `PERFORMANCE_REVIEW.md` is **STALE** where it claims "no streaming / entire response buffered" — streaming IS implemented (`generate_stream` + `emit("stream-token")`), so chat latency is now *time-to-first-token*, not *total-time*.

## Startup
- [~] **Cold start:** Tauri window + Rust bootstrap (<1 s) + spawn Python engine (`lib.rs:87-157`) + embedder pre-warm thread (`main.py:70-78`). Engine `ready` line emitted before any model load. Estimate **1-3 s** to interactive window.
- [~] **Warm start:** SQLite + FAISS load from `~/.khoji` disk; no re-index. Estimate **<1 s** slower than cold only by DB-open.
- **Model pre-load:** NOT done at startup (lazy). First chat/search triggers `llm.load()` / `embedder.load()` — see Chat / Embedding.

## OCR
- [~] **PDF:** PyMuPDF per-page text + RapidOCR (ONNX) for scans. CPU-bound; estimate **0.5-2 s/page** on i5. Scanned pages add RapidOCR inference (~0.3-1 s/page).
- **Parallelism:** Single-threaded engine loop; OCR runs inline per `process_document` call (blocks that one request only).
- **Failure mode:** Missing OCR engine → empty result, no crash.

## Embedding
- [~] **Model:** `all-MiniLM-L6-v2` (384-dim) via sentence-transformers, CPU.
- [~] **First load:** Downloads from HuggingFace if uncached (`embeddings.py:38`) → **network-dependent first run**; once in `~/.cache/huggingface` it's local. Load estimate **2-5 s**.
- [~] **Per doc:** Embedding all chunks; estimate **0.1-0.3 s/1000 tokens** on CPU. A 50-page PDF (~15-30k tokens) ≈ **3-10 s** embed phase.
- **Silent failure:** If embedder can't load, `processor.py:87-88` logs + continues → doc marked `ready` with **no vectors** → search empty (see BUG-008).

## Search
- [~] **FAISS `IndexFlatIP`** exact search over `~/.khoji/vectors`; single query ≈ **1-10 ms** (small index). Dominated by embedder.encode of the query (~50-150 ms first call, cached model).
- **Concurrency:** Index guarded by a `threading.Lock` (`vector_search.py`); searches are cheap.

## Chat
- [~] **Streaming (new):** `llm.generate_stream` emits tokens as produced; `lib.rs` forwards each as `stream-token` → UI renders incrementally. **Time-to-first-token ≈ model load + 1-2 s**; full answer streams over a few seconds (qwen2.5-0.5b, ~0.5B params, CPU ≈ **10-30 tok/s** on i5).
- [~] **Model load:** `llm.load()` builds `Llama` with `n_ctx` per preset; first load **3-8 s**; cached in-process (singleton `get_llm`). Subsequent chats reuse.
- **Multi-turn:** Last 10 turns forwarded (`CHAT_HISTORY_MAX_MESSAGES=10`); adds ~0.5-1 s of prompt tokens.
- **Context cap:** `CHAT_CONTEXT_MAX_CHARS=2000` doc context; tinyllama `n_ctx=2048` (smallest model) — long docs + long history can approach the window.

## Export
- [~] **Markdown/JSON:** Pure string assembly from DB; **<100 ms** for a typical doc.
- [~] **CSV (library):** Iterates all docs; still **<1 s** for hundreds of docs.
- **Disk write:** `save_export` → `~/Documents` fixed filenames (overwrites — BUG-013 security note). No compression.

## Resource footprint (estimates, i5 / 8 GB)
| Phase | Idle RAM | OCR RAM | Inference RAM | Peak RAM | CPU | Disk | Threads |
|-------|----------|---------|---------------|----------|-----|------|---------|
| App idle (no model) | ~150-250 MB | — | — | ~250 MB | low | — | 2-4 |
| Engine + embedder loaded | — | — | — | ~600 MB-1.2 GB | low | model cache | 4-8 |
| OCR (RapidOCR ONNX) | — | +300-600 MB | — | +600 MB | high (spiky) | — | 4-8 |
| LLM inference (0.5B) | — | — | +400-800 MB | +800 MB | high | — | n_threads (≈4-6) |
| LLM inference (1.5B) | — | — | +1.2-2 GB | +2 GB | high | — | n_threads |
| FAISS index in RAM | — | — | — | +index size (MBs) | — | persists | — |

- **8 GB total budget:** Comfortable for embedder + 0.5B LLM + OCR simultaneously. **1.5B LLM + OCR concurrently may approach 4-5 GB** — still within 8 GB but leaves less headroom for the OS/desktop.
- **`detect_hardware()` is DEAD** (`llm.py:85-104`) — auto model-selection by RAM **never runs**; always defaults to `qwen2.5-0.5b`. Implication: the "auto-pick by hardware" claim is **not implemented**; the smallest model is always used regardless of available RAM.

## Thread model
- **Rust:** Single Tauri event loop; engine held in `Mutex<Child>` (`lib.rs:27-29`). No engine thread pool.
- **Python:** Single subprocess, one NDJSON message at a time (blocking per request). Embedder pre-warm is the only background thread (`main.py:70-78`).
- **Frontend:** React main thread; Tauri `invoke` + event listeners are async; streaming renders on the UI thread without blocking input (input disabled via `isStreaming`).

## Database size
- SQLite WAL at `~/.khoji/khoji.db`; grows with chunks + embeddings metadata (embeddings themselves live in FAISS, not SQLite). A 50-page doc ≈ **few hundred KB** DB + **few MB** FAISS index. No compaction/backup tool ships.

## Bottlenecks / risks
1. **Single-threaded engine:** concurrent uploads/queries serialize; a slow OCR blocks that one request (others queue on the Mutex).
2. **No engine auto-restart:** a crash/hang freezes all IPC (no read timeout — BUG-014).
3. **First-run network:** embedding + LLM download dominate first-use latency; pre-stage for demos.
4. **Smallest model always used:** dead `detect_hardware` → underutilizes RAM on the 8 GB target.
5. **`n_ctx` cap:** tinyllama (2048) can truncate long doc+history prompts.

## Improvement opportunities (no code changed)
- Pre-warm the LLM on first model select (not first chat) → hides load latency.
- Cache `generate_timeline`/`generate_mindmap` per doc (re-fetched every tab open today).
- Offload OCR to a worker thread / process pool to keep the engine loop responsive.
- Wire `detect_hardware()` so larger models auto-select on 8 GB+ machines.
