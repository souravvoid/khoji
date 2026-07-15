# Known Limitations — Khoji Final QA

Honest boundary list for the submission. None block the demo; each is a known
ceiling with an upgrade path.

## Model / LLM
- **Corrupt or missing GGUF → chat degraded, not dead.** If the
  auto-selected model's cached GGUF is corrupt/incomplete, `get_llm()` now
  falls back to another cached preset (e.g. `qwen2.5-0.5b`). If **no** model
  loads, chat/study features return a clear "model failed to load" error
  rather than crashing. Fix shipped in `df492e2`.
- **Only Qwen-style GGUFs are recognised** by `detect_hardware()`
  (`qwen2.5-0.5b/1.5b`, `smollm2-1.7b`, `tinyllama-1.1b`). A user who
  drops a non-Qwen GGUF in `~/.khoji/models` must select it explicitly via
  `set_model()`; auto-detection won't pick it up.
- **First chat call pays model-load latency** (~1.8 s for 0.5B). Subsequent
  calls stream immediately. On boxes with more RAM, the larger 1.5B model is
  preferred and is slower/heavier.

## Ingestion
- **OCR is best-effort.** RapidOCR (ONNX) is tried first, then the Tesseract
  CLI; if neither is present, scanned/image-only pages yield no extractable text
  (handled gracefully — see TESTING.md). `rapidocr-onnxruntime` is in the
  deps and installed in the test venv.
- **Image-only PDFs / corrupt files** return `success:false` with
  "No text could be extracted" — by design, not a bug.
- **Very large single documents** are chunked; notes generation is one LLM call,
  so a many-thousand-word doc is the dominant ingest cost (still seconds, not
  minutes, at tested sizes).

## Dependencies / portability
- **`.venv` must launch the engine *without* resolving the python symlink**, or
  transitive deps (`packaging`, `typing_extensions`) go missing. Documented in
  TESTING.md; the Tauri/Rust bridge does this correctly in production.
- **Linux-only deliverable** for this build (`AppImage`). The engine itself is
  cross-platform Python; packaging for macOS/Windows would need separate Tauri
  bundling.

## Scalability
- FAISS `IndexFlatIP` is exact (no quantization) — perfect for single-user
  corpora, but a very large library (tens of thousands of chunks) would benefit
  from an `IndexIVF`/`IndexHNSW` swap. Out of scope for the hackathon.
