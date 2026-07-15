# AI Pipeline Explained

## Overview

Khoji's AI pipeline consists of four core components:

1. **Embedding Model** — Converts text to 384-dimensional vectors
2. **Vector Search** — FAISS-based cosine similarity search
3. **Local LLM** — GGUF-quantized language models for chat
4. **Content Generators** — Rule-based flashcards, quizzes, timelines, mind maps

All components run **100% locally** on the user's machine. No cloud APIs are used.

## 1. Embedding Model

### Model: all-MiniLM-L6-v2

| Property | Value |
|----------|-------|
| Architecture | MiniLM (6 layers) |
| Dimensions | 384 |
| Size | ~80 MB |
| Speed | ~1000 sentences/sec (CPU) |
| Quality | Good for semantic similarity |
| Library | sentence-transformers (PyTorch) |

### How It Works

```
Input text → Tokenize → Transformer layers → Mean pooling → L2 normalize → 384-dim vector
```

### Implementation (`ai/embeddings.py`)

```python
class Embedder:
    def load(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def embed(self, texts: list[str]) -> np.ndarray:
        return self.model.encode(texts, normalize_embeddings=True)
    
    def embed_one(self, text: str) -> np.ndarray:
        return self.model.encode([text], normalize_embeddings=True)[0]
```

### L2 Normalization

Vectors are L2-normalized so that inner product equals cosine similarity:

```
cosine_sim(A, B) = A·B / (||A|| × ||B||)

If ||A|| = ||B|| = 1 (normalized):
cosine_sim(A, B) = A·B = inner_product(A, B)
```

This is why FAISS uses `IndexFlatIP` (inner product) instead of `IndexFlatL2`.

### When It Loads

The embedding model is pre-warmed in a **background daemon thread** at engine startup. This hides the ~2-3 second loading latency. If the model hasn't been downloaded yet, it downloads from HuggingFace on first use (~80 MB).

## 2. Vector Search

### Index: FAISS IndexFlatIP

| Property | Value |
|----------|-------|
| Index type | Flat (brute-force) |
| Similarity | Inner product (= cosine for normalized vectors) |
| Dimension | 384 |
| Storage | `~/.khoji/vectors/vectors.index` + `metadata.json` |
| Thread safety | `threading.Lock()` around mutations |

### How FAISS Works

FAISS (Facebook AI Similarity Search) is a library for efficient similarity search:

1. **Build phase**: Add vectors to the index
2. **Search phase**: Query vector is compared against all indexed vectors
3. **Result**: Top-k nearest neighbors with scores

`IndexFlatIP` is a brute-force index — it scans every vector. This is O(n) per query but fast enough for thousands of documents (milliseconds for 10K vectors).

### Search Flow

```
User query → Embedder.embed_one(query) → L2 normalize → FAISS search(query, k=10)
    ↓
Returns: [{chunk_id: "abc", score: 0.87}, ...]
    ↓
Enrich with DB: fetch chunk content, document title
    ↓
Return: [{chunk_id, doc_id, score, content, page_number, doc_title}, ...]
```

### Vector Persistence

After every mutation (add/remove), the entire index is saved:
- `vectors.index`: FAISS binary format
- `metadata.json`: Array of `{chunk_id, doc_id, chunk_index}` objects

**Weakness**: Full save on every mutation. For large indices (100K+ vectors), this could be slow.

### Document Removal

`remove_document(doc_id)` rebuilds the index from scratch:
1. Iterate all vectors
2. Reconstruct vectors NOT belonging to the deleted document
3. Create new `IndexFlatIP`
4. Add kept vectors to new index
5. Save

This is O(n) in the number of vectors — acceptable for typical use.

## 3. Local LLM

### Available Models

| ID | Model | Size | RAM | Quality | Context | Quantization |
|----|-------|------|-----|---------|---------|--------------|
| `qwen2.5-0.5b` | Qwen2.5 0.5B Instruct | ~350 MB | 500 MB | ★☆☆☆☆ | 4096 | Q4_K_M |
| `qwen2.5-1.5b` | Qwen2.5 1.5B Instruct | ~1 GB | 1200 MB | ★★★☆☆ | 4096 | Q4_K_M |
| `smollm2-1.7b` | SmolLM2 1.7B Instruct | ~1 GB | 1400 MB | ★★★☆☆ | 4096 | Q4_K_M |
| `tinyllama-1.1b` | TinyLlama 1.1B Chat | ~650 MB | 900 MB | ★★☆☆☆ | 2048 | Q4_K_M |

**Default**: `qwen2.5-0.5b` (smallest, fastest)

### Quantization: Q4_K_M

Q4_K_M means:
- **Q4**: 4-bit quantization (each weight stored in 4 bits instead of 32)
- **K**: K-quant method (mixed precision)
- **M**: Medium quality level

This reduces model size by ~8x with minimal quality loss. A 3.5B parameter model becomes ~350 MB.

### How It Works (`ai/llm.py`)

```python
class LocalLLM:
    def load(self):
        self._llm = Llama(
            model_path=self.config.model_path,
            n_ctx=self.config.context_length,
            n_gpu_layers=0,       # CPU-only
            n_threads=cpu_count - 2  # Leave cores for OS
        )
    
    def generate(self, messages: list[dict]) -> str:
        response = self._llm.create_chat_completion(messages=messages)
        return response['choices'][0]['message']['content']
    
    def generate_stream(self, messages: list[dict]):
        stream = self._llm.create_chat_completion(messages=messages, stream=True)
        for chunk in stream:
            content = chunk['choices'][0]['delta'].get('content', '')
            if content:
                yield content
```

### Hardware Detection

`detect_hardware()` queries `psutil.virtual_memory()` and selects the highest-quality model that fits within `available_RAM × 1.5` headroom. Falls back to `tinyllama-1.1b` if psutil is unavailable.

### Prompt Construction

Chat prompts use a simple template:

```
Context from document:
{first 2000 characters of document notes}

User question: {user_message}

Provide a helpful answer based on the document context.
```

**Note**: Conversation history is NOT sent to the LLM. Each chat message is stateless — only the document context is included. This is a significant limitation for multi-turn conversations.

### Model Loading

Models load lazily on first `generate()` call. The first generation after load takes ~5-10 seconds (model initialization). Subsequent generations are faster (~1-3 seconds for 0.5B, ~3-8 seconds for 1.5B).

## 4. Content Generators

### Flashcard Generation (`pipeline/content_generator.py`)

**Rule-based** — no LLM required.

Algorithm:
1. Split text into sentences (regex: `(?<=[.!?])\s+`)
2. Filter sentences < 15 characters
3. For each sentence, detect:
   - **Definition pattern**: `X is/are/refers to/means/denotes Y` → card: "What is X?" / Y
   - **Fact pattern**: Contains numbers or frequency words → card: sentence / "(See source document)"
4. Fallback: If < 5 cards and > 10 sentences, pair consecutive sentences as context cards
5. Shuffle and cap at 20 cards

### Quiz Generation (`pipeline/content_generator.py`)

**Rule-based** — no LLM required.

Algorithm:
1. Same sentence splitting as flashcards
2. For each definition sentence:
   - Create MCQ with term as question, definition as correct answer
   - Generate 3 distractors from other sentences
3. For each fact sentence:
   - Create fill-in-blank with first number replaced by `___`
   - Generate distractors as `number ± {5, 2, 3, 7}`
4. Shuffle and cap at 10 questions

### Timeline Generation (`pipeline/structure_generator.py`)

**Regex-based** — extracts date mentions.

Algorithm:
1. Match years: `19xx`, `20xx`
2. Match month+year: `January 2024`, `Mar 2023`
3. Match decades: `the 1960s`
4. Create `{date, title, description}` events
5. Sort chronologically, cap at 20 events

### Mind Map Generation (`pipeline/structure_generator.py`)

**Heading-based** — extracts document structure.

Algorithm:
1. Extract `#` heading as central topic
2. Extract `##` headings as branches (max 4)
3. Extract `###` headings, definitions, or bullet points as leaves (max 4 per branch)
4. Fallback: Use first long sentences if no headings found
5. Convert to Mermaid flowchart syntax

## 5. Performance Characteristics

| Operation | Time (approx) | Memory |
|-----------|---------------|--------|
| Embedding model load | 2-3 sec | 80 MB |
| Embed 100 chunks | <1 sec | 80 MB |
| FAISS search (10K vectors) | <10 ms | 15 MB |
| LLM load (0.5B) | 5-10 sec | 500 MB |
| LLM generate (0.5B, 100 tokens) | 1-3 sec | 500 MB |
| LLM load (1.5B) | 10-15 sec | 1200 MB |
| LLM generate (1.5B, 100 tokens) | 3-8 sec | 1200 MB |
| Flashcard generation | <1 sec | Negligible |
| Quiz generation | <1 sec | Negligible |

## 6. Memory Budget

For a typical 8GB RAM system:

| Component | RAM | Notes |
|-----------|-----|-------|
| OS + Desktop | ~2 GB | Varies by distro |
| Tauri/WebView | ~300 MB | Chromium rendering |
| Python engine | ~100 MB | Base Python |
| Embedding model | ~80 MB | all-MiniLM-L6-v2 |
| FAISS index | ~15 MB | 10K vectors |
| SQLite | ~10 MB | Database + WAL |
| **LLM (0.5B)** | **~500 MB** | Default model |
| **Total** | **~3 GB** | With 0.5B model |

With 4GB RAM: Only the 0.5B model fits comfortably.  
With 8GB RAM: 0.5B and 1.5B models work. 1.7B is tight.  
With 16GB RAM: All models work. Can run 1.5B + embeddings simultaneously.
