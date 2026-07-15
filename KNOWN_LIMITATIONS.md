# Known Limitations — Khoji v1.0.0

This document outlines the architectural and environment-specific limitations of Khoji v1.0.0.

---

## 1. Offline & Model Bootstrapping
- **Internet Requirement for First Run:** Khoji is fully offline-first, but it requires an internet connection on first launch to download selected GGUF models (via the Settings manager) and fetch the embedding model weights from Hugging Face.
- **Air-Gapped Setup:** To run in a completely air-gapped demo environment, the models must be pre-cached under `~/.khoji/models/` and `~/.cache/huggingface/`. Refer to `LOCAL_AI_VERIFICATION.md` for staging instructions.

---

## 2. Process & Threading Model
- **Single Python Subprocess:** Rust/Tauri communicates with a single Python child process. While Tauri commands run asynchronously, calls to the Python engine are serialized through a Rust `Mutex` to prevent concurrent write collisions on SQLite and the FAISS index.
- **Blocked Operations:** Heavy operations (such as document ingestion) block other synchronous requests from executing in Python. Progress status updates and chat tokens are streamed out asynchronously using NDJSON line events, but new requests are queued until the active action finishes.

---

## 3. CPU Inference (GPU Acceleration Disabled)
- **CPU-Only Defaults:** By default, llama-cpp-python is configured with `n_gpu_layers = 0`. This is done to ensure maximum compatibility across varying judge hardware configurations without crashing on missing graphics drivers.
- **Performance Impact:** Token generation rates are limited by CPU compute speeds (~15-30 tokens/second on Intel i5). GPU acceleration (CUDA/ROCm/Metal) is not enabled out-of-the-box.

---

## 4. Context Window Size
- **Quantized Preset Limits:** Context windows for local LLMs are capped at **2048-4096 tokens** depending on the model selected.
- **Truncation:** If a document notes section is extremely long and the chat session contains many back-and-forth turns, the engine will truncate history and context using a last-10-messages buffer (`CHAT_HISTORY_MAX_MESSAGES = 10`) to avoid exceeding the context limits.

---

## 5. OCR Ingestion Throughput
- **Single-Threaded OCR:** OCR processing is CPU-bound. If a large scanned PDF (e.g., 50+ pages) is imported, it is processed page-by-page. On typical i5 processors, this may take **30-90 seconds**.
