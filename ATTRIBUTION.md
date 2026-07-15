# Khoji — Third-Party Attributions

Khoji is free software released under the **GNU General Public License v3.0**
(GPLv3). This file lists the third-party components Khoji builds on, along with
their licenses, so redistributors can satisfy attribution and copyleft
obligations.

## Application license

- **Khoji** itself (desktop shell, frontend, Python engine) — **GPLv3**.
  See the `LICENSE` file in the repository root.
  Copyright (C) 2026 the Khoji authors.

## Desktop shell and frontend

| Component | License | Role |
|-----------|---------|------|
| Tauri v2 (Rust framework) | Apache-2.0 / MIT (dual) | Desktop application shell |
| React 19 | MIT | UI framework |
| React DOM 19 | MIT | UI rendering |
| Vite 8 | MIT | Build tooling / dev server |
| Zustand 5 | MIT | State management |
| react-markdown | MIT | Markdown rendering |
| remark-gfm | MIT | GitHub-flavored Markdown |
| lucide-react (Lucide icons) | ISC | UI icons |
| Tailwind CSS 4 | MIT | Styling |
| Playwright | Apache-2.0 | End-to-end UI tests (dev only) |

## Python AI engine

Runtime dependencies are declared in `backend/python/pyproject.toml`. Licenses
below are the upstream licenses of each package.

| Component | License | Role |
|-----------|---------|------|
| PyMuPDF (`fitz`) >=1.25 | **GNU AGPL-3.0** (commercial license available) | PDF / document text extraction |
| numpy >=2.0 | BSD-3-Clause | Numerical arrays |
| sentence-transformers >=3.0 | Apache-2.0 | Embedding model interface |
| faiss-cpu >=1.9 | MIT | Vector similarity search |
| llama-cpp-python >=0.3 | MIT | Local LLM (GGUF) inference |
| python-docx >=1.1 | MIT | DOCX parsing |
| python-pptx >=1.0 | MIT | PPTX parsing |
| EbookLib >=0.18 | GNU AGPL-3.0 | EPUB parsing |
| torch | BSD-3-Clause | ML runtime (CPU index) |

### Optional OCR dependencies

OCR is an optional feature, enabled via the `ocr` extra in `pyproject.toml`
(`rapidocr-onnxruntime>=1.0`). When present, Khoji uses it in preference to the
system Tesseract binary.

| Component | License | Role |
|-----------|---------|------|
| RapidOCR / `rapidocr-onnxruntime` | Apache-2.0 | Primary OCR engine (ONNX) |
| ONNXRuntime | MIT | Inference runtime used by RapidOCR |
| Tesseract (system binary, optional CLI fallback) | Apache-2.0 | Secondary OCR engine |

Tesseract is invoked as a system-installed binary through its CLI; it is not a
Python dependency and only used if RapidOCR is unavailable
(`backend/python/khoji_engine/pipeline/ocr.py`).

## Model weights

The embedding model and the local LLM weights are separate artifacts from the
application code and carry their own licenses. All models Khoji uses by default
are permissively licensed.

| Model | License | Source | Notes |
|-------|---------|--------|-------|
| all-MiniLM-L6-v2 (embeddings) | Apache-2.0 | sentence-transformers / HuggingFace | 384-dim, ~80 MB |
| Qwen2.5-0.5B / 1.5B-Instruct (GGUF) | Apache-2.0 | Qwen / HuggingFace | Default LLM presets |
| SmolLM2-1.7B-Instruct (GGUF) | Apache-2.0 | HuggingFaceTB / HuggingFace | LLM preset |
| TinyLlama-1.1B-Chat (GGUF) | Apache-2.0 | TinyLlama / HuggingFace (TheBloke GGUF) | LLM preset |

## Copyleft implications for redistributors

Khoji is licensed **GPLv3**, a strong copyleft license. If you distribute
Khoji — including modified versions, or as part of a larger work — you must:

- Provide the complete corresponding source code under GPLv3.
- Preserve the GPLv3 license notices and the `LICENSE` file.
- Not impose additional restrictions that prevent recipients from exercising
  their GPLv3 rights.

Two of the bundled runtime libraries — **PyMuPDF** and **EbookLib** — are
licensed under **GNU AGPL-3.0**, an even stronger copyleft that additionally
triggers source-disclosure obligations if the software is offered over a
network. Combining GPLv3 application code with AGPL-3.0 libraries is
permissible, but the resulting combined work must be distributed under the
terms of the **AGPL-3.0** (the more restrictive of the two). Redistributors
should be aware that shipping Khoji with PyMuPDF/EbookLib brings the whole
distribution under AGPL-3.0 obligations. All other listed dependencies use
permissive licenses (MIT, Apache-2.0, BSD, ISC) that are compatible with and
impose no conflict on the GPLv3/AGPL-3.0 application license.

The model weights listed above are Apache-2.0 and impose no copyleft
obligation on the application; they may be redistributed alongside Khoji under
their own license terms.
