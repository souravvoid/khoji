# Dependency Analysis

## Overview

Khoji has dependencies across three layers: Python (AI engine), Rust (Tauri shell), and Node.js (React frontend). This document analyzes each dependency, its purpose, and version requirements.

## Python Dependencies (`pyproject.toml`)

### Core Dependencies

| Package | Version | Purpose | Size | Alternatives |
|---------|---------|---------|------|--------------|
| `PyMuPDF` | >=1.25 | PDF text extraction | ~30 MB | pdfplumber, pdfminer |
| `numpy` | >=2.0 | Array operations, FAISS | ~30 MB | (required by many) |
| `sentence-transformers` | >=3.0 | Embedding model | ~200 MB | (core dependency) |
| `faiss-cpu` | >=1.9 | Vector similarity search | ~10 MB | annoy, chromadb |
| `llama-cpp-python` | >=0.3 | Local LLM inference | ~5 MB (binding) | ctransformers |
| `python-docx` | >=1.1 | DOCX text extraction | ~1 MB | docx2txt |
| `python-pptx` | >=1.0 | PPTX text extraction | ~2 MB | (none mature) |
| `EbookLib` | >=0.18 | EPUB text extraction | ~1 MB | (none mature) |
| `torch` | (CPU) | PyTorch for embeddings | ~200 MB | (required by sentence-transformers) |

### Optional Dependencies

| Package | Version | Purpose | When Needed |
|---------|---------|---------|-------------|
| `rapidocr-onnxruntime` | >=1.0 | OCR for images/scans | Only if OCR needed |
| `pytest` | >=8.0 | Testing framework | Development only |
| `ruff` | >=0.8 | Python linter | Development only |

### Dependency Tree

```
khoji-engine
├── PyMuPDF (PDF extraction)
├── numpy (array ops)
├── sentence-transformers
│   ├── torch (PyTorch)
│   ├── transformers (HuggingFace)
│   ├── tokenizers
│   └── huggingface-hub
├── faiss-cpu (vector search)
├── llama-cpp-python (LLM inference)
├── python-docx (DOCX extraction)
├── python-pptx (PPTX extraction)
└── EbookLib (EPUB extraction)
```

### Version Pinning

- **No upper bounds**: All dependencies use `>=` (minimum version only)
- **Lock file**: `uv.lock` pins exact versions for reproducible installs
- **PyTorch**: Installed from CPU-only index (`download.pytorch.org/whl/cpu`)

### Size Impact

| Component | Size |
|-----------|------|
| Python stdlib | ~50 MB |
| torch (CPU) | ~200 MB |
| sentence-transformers | ~200 MB |
| numpy | ~30 MB |
| PyMuPDF | ~30 MB |
| faiss-cpu | ~10 MB |
| Other packages | ~20 MB |
| **Total Python** | **~540 MB** |

### Known Issues

1. **torch CPU-only**: Must install from specific index URL to avoid CUDA dependencies
2. **sentence-transformers**: Pulls in transformers, tokenizers, huggingface-hub — large dependency tree
3. **llama-cpp-python**: Requires C compilation on some systems (pre-built wheels available)
4. **PyMuPDF**: GPL license (matches Khoji's GPLv3)

## Rust Dependencies (`Cargo.toml`)

| Crate | Version | Purpose | Size |
|-------|---------|---------|------|
| `tauri` | 2.x | Desktop app framework | ~5 MB |
| `tauri-plugin-dialog` | 2.x | Native file dialogs | ~100 KB |
| `serde` | 1.x | Serialization | ~100 KB |
| `serde_json` | 1.x | JSON handling | ~50 KB |

### Dependency Tree

```
khoji (Rust)
├── tauri (2.x)
│   ├── tauri-runtime
│   ├── tauri-core
│   └── webview (system)
├── tauri-plugin-dialog (2.x)
├── serde (1.x)
└── serde_json (1.x)
```

### Build Requirements

- Rust toolchain (stable)
- System libraries: webkit2gtk (Linux), WebView2 (Windows), WKWebView (macOS)
- Tauri CLI for building

### Size Impact

| Component | Size |
|-----------|------|
| Rust binary | ~5 MB |
| Tauri runtime | ~10 MB |
| Webview | System-provided |
| **Total Rust** | **~15 MB** |

## Node.js Dependencies (`package.json`)

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19 | UI framework |
| `react-dom` | 19 | DOM rendering |
| `@tauri-apps/api` | 2.x | Tauri IPC |
| `@tauri-apps/plugin-dialog` | 2.x | File dialogs |
| `zustand` | Latest | State management |
| `react-markdown` | Latest | Markdown rendering |
| `remark-gfm` | Latest | GitHub-flavored Markdown |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 6 | Type checking |
| `vite` | 8 | Build tool |
| `@vitejs/plugin-react` | Latest | React support |
| `tailwindcss` | 4 | CSS framework |
| `@tailwindcss/vite` | Latest | Tailwind integration |
| `oxlint` | Latest | Linting |
| `playwright` | Latest | E2E testing |
| `@playwright/test` | Latest | Test runner |

### Size Impact

| Component | Size |
|-----------|------|
| node_modules | ~200 MB |
| dist/ (build output) | ~2 MB |
| **Total Node.js** | **~202 MB** |

## Combined Size

| Layer | Size |
|-------|------|
| Python engine + deps | ~540 MB |
| Rust binary + deps | ~15 MB |
| Frontend build | ~2 MB |
| AI models (optional) | ~3 GB |
| **Total (without models)** | **~557 MB** |
| **Total (with all models)** | **~3.5 GB** |

## Version Compatibility

### Python
- Requires Python >=3.12
- Tested with Python 3.14
- Uses `uv` for package management

### Rust
- Requires Rust stable toolchain
- Edition 2021
- Tauri v2 (latest stable)

### Node.js
- Requires Node.js 20+ (for Vite 8)
- Uses npm for package management

## Security Considerations

### Known Vulnerabilities

Run these regularly:
```bash
# Python
pip-audit
safety check

# Rust
cargo audit

# Node.js
npm audit
```

### License Compatibility

| Package | License | Compatible with GPLv3? |
|---------|---------|----------------------|
| PyMuPDF | AGPL/GPL | Yes (GPLv3) |
| torch | BSD | Yes |
| sentence-transformers | Apache 2.0 | Yes |
| faiss-cpu | MIT | Yes |
| llama-cpp-python | MIT | Yes |
| python-docx | MIT | Yes |
| python-pptx | MIT | Yes |
| EbookLib | AGPL | Yes (GPLv3) |
| React | MIT | Yes |
| Vite | MIT | Yes |
| Tailwind CSS | MIT | Yes |
| Tauri | MIT/Apache 2.0 | Yes |

All dependencies are compatible with GPLv3.

## Update Strategy

### Python
- Pin minimum versions with `>=`
- Use `uv.lock` for reproducible builds
- Update dependencies monthly via `uv lock --upgrade`

### Rust
- Use `cargo update` for patch updates
- Test major version updates manually

### Node.js
- Use `npm update` for patch updates
- Test major version updates manually

### AI Models
- Models are downloaded once and cached
- No automatic updates
- Manual re-download for new versions
