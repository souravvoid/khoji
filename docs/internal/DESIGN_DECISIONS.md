# Design Decisions

## Overview

This document captures the major architectural and design decisions made in Khoji, the rationale behind each, and the tradeoffs involved.

## 1. Tauri + React + Python Architecture

### Decision
Use Tauri (Rust) as the desktop shell, React for the frontend, and Python as the AI engine backend.

### Rationale
- **Tauri**: Smaller binary size than Electron (~10 MB vs ~150 MB), better performance, native Rust
- **React**: Large ecosystem, familiar to most developers, strong TypeScript support
- **Python**: Best AI/ML ecosystem (PyTorch, sentence-transformers, llama-cpp-python), faster prototyping

### Tradeoffs
- **Pro**: Best tool for each job
- **Con**: Three languages to maintain (Rust, TypeScript, Python)
- **Con**: Complex build process
- **Con**: IPC overhead between layers

### Alternatives Considered
- **Electron + Python**: Rejected due to binary size and performance
- **Tauri + Rust only**: Rejected due to limited AI/ML libraries in Rust
- **Tauri + Python only**: Rejected due to limited UI frameworks in Python

## 2. Python as Separate Process (Not Embedded)

### Decision
Run Python as a separate subprocess communicating via stdin/stdout JSON, not embedded in the Rust binary.

### Rationale
- **Isolation**: Python crashes don't crash the app
- **Flexibility**: Can use any Python version, any packages
- **Simplicity**: No complex FFI or embedding required
- **Debugging**: Python process can be inspected independently

### Tradeoffs
- **Pro**: Simple, reliable, debuggable
- **Con**: IPC overhead (JSON serialization/deserialization)
- **Con**: Single-threaded bottleneck (Mutex<Child>)
- **Con**: No streaming (synchronous request/response)

### Alternatives Considered
- **PyO3/maturin**: Embed Python in Rust. Rejected due to complexity and packaging issues
- **FFI calls**: Direct function calls. Rejected due to GIL and memory management
- **HTTP server**: Python runs as HTTP server. Rejected due to security and complexity

## 3. Newline-Delimited JSON IPC

### Decision
Use newline-delimited JSON over stdin/stdout for IPC between Rust and Python.

### Rationale
- **Simplicity**: Easy to implement on both sides
- **Debugging**: Messages are human-readable
- **Reliability**: No partial message issues (newline-delimited)
- **Standard**: Well-understood pattern

### Tradeoffs
- **Pro**: Simple, debuggable, reliable
- **Con**: No binary efficiency (JSON overhead)
- **Con**: No streaming (one message per response)
- **Con**: No multiplexing (Mutex serialization)

### Alternatives Considered
- **gRPC/protobuf**: Rejected due to complexity for this use case
- **MessagePack**: Rejected for readability
- **Unix domain sockets**: Rejected for simplicity

## 4. FAISS IndexFlatIP for Vector Search

### Decision
Use FAISS with IndexFlatIP (brute-force inner product) for vector search.

### Rationale
- **Simplicity**: No index building, no training required
- **Accuracy**: Brute-force is exact (no approximation)
- **Performance**: Fast enough for thousands of documents
- **Dependencies**: faiss-cpu is well-maintained and easy to install

### Tradeoffs
- **Pro**: Simple, accurate, fast for small datasets
- **Con**: O(n) search time (not scalable to millions of vectors)
- **Con**: Full rebuild on document removal
- **Con**: No incremental index updates

### Alternatives Considered
- **HNSW**: Better performance at scale, but requires training and more complex setup
- **Annoy**: Spotify's library, but less flexible than FAISS
- **pgvector**: PostgreSQL extension, but adds database dependency
- **ChromaDB**: Higher-level API, but adds complexity

## 5. SQLite for Persistence

### Decision
Use SQLite with WAL mode for all persistence.

### Rationale
- **Simplicity**: Single file database, no server
- **Performance**: Excellent for desktop apps
- **Reliability**: ACID transactions, WAL mode for concurrency
- **Dependencies**: Built into Python stdlib

### Tradeoffs
- **Pro**: Simple, fast, reliable, no setup
- **Con**: No network access (single-user only)
- **Con**: Limited concurrent write performance
- **Con**: No encryption at rest (without sqlcipher)

### Alternatives Considered
- **PostgreSQL**: Rejected due to setup complexity
- **JSON files**: Rejected due to lack of transactions and queries
- **LevelDB**: Rejected due to limited query capabilities

## 6. Rule-Based Content Generation (No LLM)

### Decision
Generate flashcards, quizzes, timelines, and mind maps using rule-based algorithms, not LLM.

### Rationale
- **Speed**: Rule-based is instant (no inference delay)
- **Determinism**: Same input always produces same output
- **No model required**: Works without LLM loaded
- **Quality**: Good enough for basic study materials

### Tradeoffs
- **Pro**: Fast, deterministic, no model needed
- **Con**: Lower quality than LLM-generated content
- **Con**: Limited to simple patterns (definitions, facts)
- **Con**: No creativity or nuance

### Alternatives Considered
- **LLM-based generation**: Rejected due to latency and model requirements
- **Hybrid approach**: Use rules first, LLM for enhancement. Not implemented yet.

## 7. BMW M-Inspired Design System

### Decision
Use a BMW M-inspired "industrial precision" design with zero border-radius, M tricolor accents, and near-black canvas.

### Rationale
- **Uniqueness**: Distinctive look that stands out
- **Precision**: Industrial aesthetic conveys quality and reliability
- **Performance**: Simple styles (no complex animations)
- **Accessibility**: High contrast, clear typography

### Tradeoffs
- **Pro**: Unique, performant, accessible
- **Con**: May not appeal to all users
- **Con**: Requires careful implementation to avoid looking unfinished
- **Con**: Limited design flexibility

### Alternatives Considered
- **Material Design**: Rejected as too generic
- **Apple HIG**: Rejected as not matching the "tool" aesthetic
- **Custom minimal**: Settled on BMW M as inspiration

## 8. Deferred Imports in Handlers

### Decision
Import dependencies inside handler functions, not at module level.

### Rationale
- **Startup speed**: Heavy imports (PyMuPDF, sentence-transformers) don't slow startup
- **Memory**: Only load what's needed
- **Flexibility**: Can handle missing optional dependencies gracefully

### Tradeoffs
- **Pro**: Fast startup, lower memory, graceful degradation
- **Con**: Slight import delay on first use
- **Con**: Code harder to read (imports scattered)
- **Con**: Type checking less effective

### Alternatives Considered
- **Lazy imports**: Python 3.12+ lazy imports. Not available in all versions
- **Conditional imports**: Import at top level if available. Rejected for complexity

## 9. Singleton Pattern for AI Components

### Decision
Use module-level singletons for Embedder, VectorStore, and LocalLLM.

### Rationale
- **Simplicity**: One instance per component
- **State consistency**: Single source of truth
- **Lazy initialization**: Load on first use

### Tradeoffs
- **Pro**: Simple, consistent, lazy
- **Con**: Hard to test (global state)
- **Con**: No dependency injection
- **Con**: Can't have multiple instances

### Alternatives Considered
- **Dependency injection**: More testable, but more complex
- **Factory pattern**: More flexible, but overkill for this use case

## 10. AppImage for Linux Distribution

### Decision
Distribute as AppImage for Linux.

### Rationale
- **Simplicity**: Single file, no installation
- **Compatibility**: Works on most Linux distros
- **No dependencies**: Bundles everything needed
- **Portable**: Can run from USB drive

### Tradeoffs
- **Pro**: Simple, compatible, portable
- **Con**: Larger file size (~100 MB)
- **Con**: No automatic updates
- **Con**: No system integration (no menu entries by default)

### Alternatives Considered
- **Debian package**: More system integration, but distro-specific
- **Flatpak**: Better sandboxing, but more complex
- **Snap**: Auto-updates, but controversial

## Summary

| Decision | Rationale | Main Tradeoff |
|----------|-----------|---------------|
| Tauri + React + Python | Best tool for each job | Three languages |
| Python as separate process | Isolation and flexibility | IPC overhead |
| Newline-delimited JSON | Simplicity and debuggability | No streaming |
| FAISS IndexFlatIP | Simple and accurate | Not scalable |
| SQLite | Simple and fast | Single-user only |
| Rule-based generation | Fast and deterministic | Lower quality |
| BMW M design | Unique and precise | May not appeal to all |
| Deferred imports | Fast startup | Scattered imports |
| Singleton pattern | Simple and consistent | Hard to test |
| AppImage | Simple and compatible | Large file size |
