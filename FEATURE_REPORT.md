# Feature Report — Khoji v1.0.0

Khoji is an **offline-first AI knowledge workspace** designed to process, search, study, and interact with documents entirely on-device. This report reviews the complete feature set discovered, tested, and verified.

---

## 1. Document Ingestion & Text Extraction
Khoji accepts a wide range of document types and routes them through specialized extractors:
- **PDF Documents:** Extracted via PyMuPDF.
- **Office Documents:** Extracted via `python-docx` (.docx) and `python-pptx` (.pptx).
- **E-Books:** Extracted via `ebooklib` (.epub).
- **Images:** Scanned via RapidOCR (ONNX) or Tesseract CLI (.png, .jpg, .jpeg).
- **Text-like Formats:** Supported directly with encoding fallback (.txt, .md, .markdown, .html, .htm, .csv, .rtf).
- **Scanned PDF Fallback:** If a PDF contains no embedded text, the engine automatically falls back to rendering page images and running OCR.

---

## 2. On-Device AI Models
AI operations are performed locally without internet dependencies:
- **Local Embeddings:** `all-MiniLM-L6-v2` (384-dimensional, L2-normalized) via `sentence-transformers` for CPU-friendly vector generation.
- **Local Vector Database:** Local FAISS index (`IndexFlatIP` under `~/.khoji/vectors`) that persists query structures on disk.
- **Local LLM Engine:** Quantum GGUF (Q4_K_M) models loaded via `llama-cpp-python`. Supported presets include:
  - **Qwen2.5-0.5B** (Default, ~500 MB)
  - **Qwen2.5-1.5B** (~1.2 GB)
  - **SmolLM2-1.7B** (~1.4 GB)
  - **TinyLlama-1.1B** (~900 MB)
- **Model Download Manager:** Easily download and swap models directly within the Settings menu.

---

## 3. Core Study & Synthesis Workflows
Once a document is ingested, the engine generates study materials and visualizations:
- **Markdown Notes Workspace:** Extracts heading-aware markdown files which can be directly edited, updated, and saved (persists automatically in SQLite).
- **Spaced-Repetition Flashcards:** Generates basic and context cards based on definition and fact extraction patterns.
- **Multiple-Choice Quizzes:** Produces 10-question quizzes with contextual distractors and explanation keys.
- **Chronological Timelines:** Automatically extracts date mentions (BC/BCE, centuries, months, and standard years) and presents them as a sorted event timeline.
- **Visual Mind Maps:** Generates Mermaid flowchart syntax parsed into an interactive, zoomable, hierarchical family tree layout in the React UI.

---

## 4. RAG Chat & Semantic Search
- **Semantic Search:** Enter queries in the global search modal (triggered via Ctrl+K) to retrieve ranked snippets across all documents, featuring highlighted matches.
- **Context-Aware Chat:** Ask questions about specific documents. The LLM processes the query against local vector-retrieved snippets and maintains a multi-turn chat history.
- **Streaming Tokens:** Chat answers stream live into the panel via Tauri-native events.

---

## 5. Exporters & Integrations
Documents can be exported to multiple study formats:
- **Markdown / HTML / JSON:** Complete workspace summaries.
- **CSV:** Tabular library export.
- **Anki Flashcards:** Tab-separated cards ready for import into Anki.
- **Mermaid Diagrams:** Diagram file exports (.mmd) for external visualization.
