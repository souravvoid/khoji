# Testing Report — Khoji Final QA

## Scope
End-to-end validation of the **real** application for a hackathon final submission.
The engine was exercised exactly as production does it: the Rust/Tauri bridge
launches `python3 -m khoji_engine.main` with `PYTHONPATH=backend/python` and
talks NDJSON over stdin/stdout. No mocks, no stubs — real documents, the real
local LLM, the real FAISS index and SQLite DB.

## How to reproduce
```bash
cd backend/python
python -m venv .venv && .venv/bin/python -m ensurepip
.venv/bin/python -m uv pip install -r requirements.txt   # or: pip install -e .
# IMPORTANT: launch via the venv python WITHOUT resolving the symlink,
# otherwise venv activation is lost and transitive deps (packaging,
# typing_extensions) go missing.
PYTHONPATH=backend/python .venv/bin/python backend/python/tests/qa_e2e.py
```
The harness (`backend/python/tests/qa_e2e.py`) writes a per-run JSON summary to
a temp dir and the captured engine stderr to `/tmp/engine_run.log`.

## Environment
- Engine Python 3.14 (`.venv`); deps: PyMuPDF, numpy, sentence-transformers,
  faiss-cpu, llama-cpp-python, python-docx, python-pptx, EbookLib, torch, rapidocr-onnxruntime.
- Models cached under `~/.khoji/models`: `all-MiniLM-L6-v2` (embeddings, OK),
  `qwen2.5-0.5b` (loads), `qwen2.5-1.5b` (corrupt/incomplete GGUF),
  `tinyllama-1.1b` (corrupt GGUF), `smollm2-1.7b` (missing).

## Results (final run after fixes)
**26 / 28 cases PASS.** The 2 non-PASS cases are **correct graceful handling**,
not bugs (the app returns `success:false` with a "No text could be extracted"
message and no crash):

| Case | Result | Note |
|------|--------|------|
| ingest:txt / md / csv / pdf / docx / pptx / epub / unicode / large | PASS | all formats produce chunks + notes |
| ingest:empty | graceful `success:false` | 0-byte file → "No text could be extracted" |
| ingest:corrupt_pdf | graceful `success:false` | unreadable PDF header → same message, no crash |
| search:semantic | PASS | hits=5, top_score≈0.39 |
| search:keyword / empty-query | PASS | keyword + safe empty-query handling |
| chat:stream | PASS | 2.83 s, coherent answer (qwen2.5-0.5b) |
| flashcards / quiz / timeline / mindmap | PASS | generated from persisted notes |
| notes:save / get / no-doc | PASS | persistence + safe missing-doc |
| export:all 8 formats (md/html/json/anki/csv/quiz/mermaid/docx) | PASS | json=6005 B, csv OK |
| models:list / set-invalid-model | PASS | lists; invalid model rejected with clear error |
| cleanup:delete | PASS | doc + chunks + notes removed, DB index kept |

## What was found and fixed
Two **real** code bugs were surfaced and fixed (see BUG_REPORT.md):
- **BUG-C** — auto-selected LLM model was a corrupt GGUF → chat was dead.
  Fixed with a working-model fallback (`ai/llm.py`, commit `df492e2`).
- **BUG-D** — `export_document` with `format="json"` crashed with a TypeError.
  Fixed by adding the missing `include` parameter (`pipeline/exporter.py`, commit `225589f`).

Three earlier "failures" were harness/Python artifacts (wrong venv-python binary
and a f-string bug), not application defects — they disappear once the engine is
launched correctly. Documented so they aren't mistaken for regressions.

## Conclusion
Every user-facing feature works on real data with the real local model. The only
non-green cases are intentional, graceful rejections of files with no extractable
text. The app is stable for submission.
