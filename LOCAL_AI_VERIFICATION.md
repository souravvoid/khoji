# Khoji — Local / Offline AI Verification

This document proves the central claim of Khoji: **it runs fully on your
device, with no dependency on remote services for any feature.** It also gives
judges and reviewers a concrete way to verify that claim.

## The claim, stated plainly

Every Khoji feature executes with code and models that live on the local
machine. During normal use, **no user document, prompt, query, or generated
output is sent to any server.** The only network activity in the entire
application is an *optional, one-time* download of model weight files from
`huggingface.co` — and that step can be eliminated entirely by pre-staging the
models (see the air-gap checklist below).

## What runs locally (feature-by-feature)

| Feature | How it runs locally | Code reference |
|---------|---------------------|----------------|
| Document ingestion (PDF, DOCX, PPTX, EPUB) | PyMuPDF / python-docx / python-pptx / EbookLib extract text in-process | `khoji_engine/pipeline/` |
| OCR (scanned images) | RapidOCR (ONNX) or system Tesseract CLI, both local | `khoji_engine/pipeline/ocr.py` |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2`, CPU | `khoji_engine/ai/embeddings.py` |
| Vector / semantic search | FAISS CPU index kept in memory + on disk | `khoji_engine/ai/` vector store |
| SQLite persistence | Local `~/.khoji/khoji.db`, WAL | `khoji_engine/database/db.py` |
| Local LLM chat (RAG) | llama-cpp-python loading Qwen 0.5B/1.5B, SmolLM2, or TinyLlama GGUF | `khoji_engine/ai/llm.py` |
| Markdown notes | Generated locally from extracted text | `khoji_engine/pipeline/` |
| Flashcards | Rule-based generation (20/doc), stored locally | `khoji_engine/pipeline/` + DB |
| Quiz | MCQ generation (10/doc) via local LLM | `khoji_engine/pipeline/` |
| Timeline | Extracted locally from document text | `khoji_engine/pipeline/` |
| Mind-map | Mermaid diagram generated locally | `khoji_engine/pipeline/` |
| Search | Local SQLite `LIKE` + FAISS semantic search | `db.py`, vector store |

## What requires the network (and why it is optional)

1. **Embedding model auto-download.** `Embedder.load()` calls
   `SentenceTransformer("all-MiniLM-L6-v2")`. On first use, if the model is not
   already in the HuggingFace cache, sentence-transformers downloads it over
   HTTPS from `huggingface.co`. After the first successful load the model is
   cached and no further download occurs.

2. **LLM GGUF download.** `LocalLLM.ensure_model()` checks for the model file
   in `~/.khoji/models`. If absent, it downloads it via
   `urllib.request.urlretrieve` from a `huggingface.co` URL
   (`backend/python/khoji_engine/ai/llm.py`). The URL is a fixed model artifact
   URL, not user-controlled input.

Both are:
- **HTTPS only**, with default TLS certificate validation.
- **One-time per model**, never re-triggered once cached.
- **Data-free**: only model binaries are transferred; no user content travels.

If the models are already present on disk, **neither code path executes a
network call**, and the application is fully air-gapped.

## Verification method

### A. Pre-stage models, then run with network blocked

1. On a machine with internet, install Khoji and open it once so the models
   download and cache (or follow the air-gap checklist in section below to copy
   them in manually).
2. Move to an isolated machine (or block all egress, e.g. `ufw deny out` /
   airplane mode / a network namespace with no route).
3. Launch Khoji. Perform ingestion, search, chat, flashcard, and quiz actions.
4. Observe that all features work and that **no outbound connections** are
   made. A packet capture (e.g. `tshark` / `tcpdump`) on the loopback and
   external interfaces during the session will show only local IPC traffic
   between the Tauri shell and the Python engine.

### B. Confirm the auto-download points are the only network sources

- `grep -rn "urlretrieve\|requests.get\|http" backend/python/khoji_engine/`
  shows network calls only inside `ai/llm.py` (model URL) and inside
  `sentence_transformers` (embedding model on first load). No other module
  reaches the network.
- `embeddings.py` imports `SentenceTransformer` and references `MODEL_NAME =
  "all-MiniLM-L6-v2"` — the only remote dependency is the model fetch.
- `llm.py` lists fixed `huggingface.co` URLs in `MODEL_PRESETS`; these are the
  sole LLM network endpoints.

### C. Exact on-disk locations to pre-stage

```
~/.khoji/
  models/        GGUF files, e.g. qwen2.5-0.5b-instruct-q4_k_m.gguf
  vectors/       FAISS index + metadata (created at runtime)
  khoji.db       SQLite database (created at runtime)

~/.cache/huggingface/        sentence-transformers model cache
  hub/                        all-MiniLM-L6-v2 weights land here
```

Populating `~/.khoji/models` and `~/.cache/huggingface` before first launch
means Khoji never needs to download anything.

## Air-gap pre-stage checklist (runnable by a judge)

Run these on a machine **with** internet to prepare a portable, offline bundle,
then transfer the resulting directories to the air-gapped demo machine.

```bash
# 1. Create the Khoji data directory and models folder
mkdir -p ~/.khoji/models

# 2. Pre-download the embedding model via sentence-transformers
python - <<'PY'
from sentence_transformers import SentenceTransformer
SentenceTransformer("all-MiniLM-L6-v2")   # caches to ~/.cache/huggingface
print("embedding model cached")
PY

# 3. Pre-download a local LLM GGUF (example: Qwen 0.5B, ~500 MB)
python - <<'PY'
import urllib.request, os
from pathlib import Path
url = ("https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/"
       "qwen2.5-0.5b-instruct-q4_k_m.gguf")
dest = Path.home() / ".khoji" / "models" / "qwen2.5-0.5b-instruct-q4_k_m.gguf"
dest.parent.mkdir(parents=True, exist_ok=True)
urllib.request.urlretrieve(url, dest)
print("llm cached at", dest)
PY

# 4. Verify the artifacts exist off the network
ls -lh ~/.cache/huggingface/hub            # embedding model present
ls -lh ~/.khoji/models                     # GGUF present
```

Then, on the **air-gapped** machine, copy both directories into place and
launch Khoji:

```bash
# on the offline machine, after copying the two directories:
#   ~/.cache/huggingface/   (embedding model)
#   ~/.khoji/models/        (GGUF)
# simply start the app — no download will be attempted
./Khoji_1.0.0_amd64.AppImage      # or: npm run tauri dev
```

Optional: confirm silence with a network sniffer while using the app:

```bash
sudo tshark -i any -f "not (host 127.0.0.1 or host ::1)" -a duration:120
# Expect: no packets to external hosts during ingestion, search, and chat.
```

## Caveats to be transparent about

- The embedding model and LLM weights are **third-party artifacts** downloaded
  from HuggingFace; Khoji does not vendor them inside the repository. They must
  be present locally (downloaded once, or pre-staged) for the app to function.
- Model downloads are fetched over HTTPS and are **not checksum-verified** in
  the current build. For high-assurance offline use, obtain models from a
  trusted source and place them in `~/.khoji/models` / `~/.cache/huggingface`
  manually rather than relying on the auto-download.
- The only network egress in the codebase is the model fetch described above.
  There is no telemetry, no update check, and no remote API call of any kind.
