# Performance Report — Khoji Final QA

Measured on the live engine (real LLM + FAISS + SQLite), single run, idle box.
Absolute numbers are hardware-dependent; the goal is "feels instant for a local
offline tool," which is met.

## Timings (from qa_e2e.py, wall-clock)

| Operation | Measured | Notes |
|-----------|-----------|-------|
| Engine cold start (spawn + import) | ~0.06 s | embeddings pre-warmed on a background thread so first search isn't blocked |
| Ingest .txt (7 chunks) | ~1 s | extract + notes + embed + index |
| Ingest .pdf (4 chunks) | ~0.5 s | fitz text layer |
| Ingest .docx (4 chunks) | ~0.5 s | |
| Ingest large (~5100 words, 37 chunks) | ~2 s | well within the 30 s stream timeout |
| Semantic search | ~0.02 s | embed query (MiniLM) + FAISS FlatIP over a tiny index |
| Export (all 8 formats) | <0.1 s each | pure string/db work |
| Chat stream (qwen2.5-0.5b, ~46 chars answer) | ~2.83 s | includes model load on first call (~1.8 s), then token streaming |

## Resource usage
- **RAM:** idle engine < 300 MB; after loading the 0.5B LLM the process holds
  the model weights (~400 MB resident) until the engine is respawned. The
  Rust bridge auto-respawns a fresh engine per document, bounding steady-state
  memory. (On boxes with more RAM, `detect_hardware()` would prefer the 1.5B
  model, which is heavier — see KNOWN_LIMITATIONS.)
- **CPU:** embeddings + search are CPU-bound but sub-100 ms on a handful of
  chunks. No GPU required.
- **Disk:** SQLite DB + FAISS index under `~/.khoji`; GGUF models cached
  once under `~/.khoji/models`.

## Scaling notes
- FAISS `IndexFlatIP` is exact (no approximation) — ideal for the small
  per-user corpora a single-user desktop tool holds, and plenty fast at this
  scale. For very large libraries a coarse quantizer would help, but it is
  unnecessary here.
- Notes generation is a single LLM call per document; for very large docs it
  is the dominant ingest cost (still < a few seconds at ~5k words).

## No regressions
Fixing BUG-C/BUG-D added only a model-load fallback loop and one optional
parameter — no hot-path overhead.
