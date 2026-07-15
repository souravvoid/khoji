# Bug Report — Khoji Final QA

Two real defects were found during end-to-end testing of the live engine and both
are fixed and committed on `qa/final-testing`. (Earlier red results were
harness/Python-venv artifacts, not app bugs — see TESTING.md.)

## BUG-C — Chat dead because the auto-selected LLM model was corrupt
- **Severity:** High (core feature, no workaround)
- **Symptom:** `chat`/`chat_stream` returned `[Error: Load failed]` on this box.
- **Root cause:** `get_llm()` in `backend/python/khoji_engine/ai/llm.py` picked
  the highest-quality model for the available RAM via `detect_hardware()`. On this
  machine that is `qwen2.5-1.5b`, whose cached GGUF is corrupt/incomplete
  (619 MB, fails `llama_cpp` load). The engine logged
  `WARNING: LLM model failed to load: .../qwen2.5-1.5b-q8_0.gguf: fp16 file too short to read magic` and returned a dead model, so every chat errored.
- **Fix:** when the auto-selected model fails to load, `get_llm()` now iterates
  the other presets and keeps the first one that actually loads
  (`qwen2.5-0.5b` here). Explicit `set_model()` choices are untouched.
- **Commit:** `df492e2` (`fix(llm): fall back to a working model when auto-selected GGUF fails to load`)
- **Verification:** `chat:stream` now returns a coherent answer in ~2.8 s.

## BUG-D — JSON export crashes with TypeError
- **Severity:** Medium (feature broken for one format)
- **Symptom:** `export_document(doc_id, "json")` raised
  `TypeError: export_full_json() got an unexpected keyword argument 'include'`.
- **Root cause:** `handle_export` in `handlers.py` always forwards
  `include=payload.get("include", {})` to every format handler, but
  `export_full_json()` in `backend/python/khoji_engine/pipeline/exporter.py`
  only defined `export_full_json(doc_id, db)`. The dispatch to the JSON branch
  therefore crashed.
- **Fix:** added the optional `include: dict | None = None` parameter to
  `export_full_json()` so the dispatch is uniform across formats.
- **Commit:** `225589f` (`fix(export): accept include kwarg in export_full_json`)
- **Verification:** `export:json` PASS — produces 6005 B of valid JSON.

## Non-bugs (graceful handling, intentionally not "fixed")
- **empty file** and **corrupt PDF** ingest return `success:false` with
  `"No text could be extracted from this document."` and a valid `doc_id`, with
  no crash. This is correct behaviour for unreadable input.

## Test artifact
Regression is covered by `backend/python/tests/qa_e2e.py` (real engine subprocess).
