# IPC Verification Report

**Status**: FAILED (at endpoint 11: `download_model`)
**Date**: 2026-07-07
**Tester**: Challenger Backend 2

## Execution Command
```bash
cd "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python"
PYTHONPATH=. python3 verify_ipc.py
```

## Terminal Execution Log
```
Starting verification of IPC actions...
2026-07-07 17:29:39,191 [INFO] khoji-engine: Handling action: ping
✓ ping passed
2026-07-07 17:29:39,191 [INFO] khoji-engine: Handling action: process_document
✓ process_document passed (doc_id: 08a688bf-9c4f-4705-8418-fa61e04c7867)
2026-07-07 17:29:39,198 [INFO] khoji-engine: Handling action: search
✓ search passed
2026-07-07 17:29:39,199 [INFO] khoji-engine: Handling action: generate_flashcards
✓ generate_flashcards passed
2026-07-07 17:29:39,208 [INFO] khoji-engine: Handling action: generate_quiz
✓ generate_quiz passed
2026-07-07 17:29:39,211 [INFO] khoji-engine: Handling action: get_documents
✓ get_documents passed
2026-07-07 17:29:39,213 [INFO] khoji-engine: Handling action: get_document
✓ get_document passed
2026-07-07 17:29:39,215 [INFO] khoji-engine: Handling action: export_document
✓ export_document passed
2026-07-07 17:29:39,231 [INFO] khoji-engine: Handling action: get_models
✓ get_models passed
2026-07-07 17:29:39,234 [INFO] khoji-engine: Handling action: get_chat_history
✓ get_chat_history passed
2026-07-07 17:29:39,235 [INFO] khoji-engine: Handling action: download_model
Traceback (most recent call last):
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/verify_ipc.py", line 246, in <module>
    run_tests()
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/verify_ipc.py", line 176, in run_tests
    res = handle_message({"action": "download_model", "payload": {"model_id": "qwen2.5-0.5b"}})
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/main.py", line 180, in handle_message
    llm = LocalLLM(LLMConfig(**cfg))
TypeError: LLMConfig.__init__() got an unexpected keyword argument 'filename'
```

## Summary of Results

| Endpoint ID | Endpoint Action Name | Status | Notes |
|:---|:---|:---|:---|
| 1 | `ping` | ✓ PASS | |
| 2 | `process_document` | ✓ PASS | |
| 3 | `search` | ✓ PASS | |
| 4 | `generate_flashcards` | ✓ PASS | |
| 5 | `generate_quiz` | ✓ PASS | |
| 6 | `get_documents` | ✓ PASS | |
| 7 | `get_document` | ✓ PASS | |
| 8 | `export_document` | ✓ PASS | |
| 9 | `get_models` | ✓ PASS | |
| 10 | `get_chat_history` | ✓ PASS | |
| 11 | `download_model` | ✗ FAIL | `TypeError: LLMConfig.__init__() got an unexpected keyword argument 'filename'` |
| 12 | `check_processing_status` | - UNTESTED | Blocked by failure at endpoint 11 |
| 13 | `get_processing_progress` | - UNTESTED | Blocked by failure at endpoint 11 |
| 14 | `generate_timeline` | - UNTESTED | Blocked by failure at endpoint 11 |
| 15 | `generate_mindmap` | - UNTESTED | Blocked by failure at endpoint 11 |
| 16 | `save_notes` | - UNTESTED | Blocked by failure at endpoint 11 |
| 17 | `save_chat_session` | - UNTESTED | Blocked by failure at endpoint 11 |
| 18 | `delete_document` | - UNTESTED | Blocked by failure at endpoint 11 |

## Root Cause Analysis
Inside `backend/python/khoji_engine/main.py` lines 174-182:
```python
    elif action == "download_model":
        from khoji_engine.ai.llm import get_llm, MODEL_PRESETS, LocalLLM, LLMConfig
        model_id = payload.get("model_id", "")
        cfg = MODEL_PRESETS.get(model_id)
        if not cfg:
            return {"status": "error", "error": f"Unknown model: {model_id}"}
        llm = LocalLLM(LLMConfig(**cfg))
        llm.ensure_model()
        return {"status": "ok", "result": {"model_id": model_id, "downloaded": True}}
```
The dictionary `MODEL_PRESETS[model_id]` is unpacked into `LLMConfig.__init__` using the `**cfg` syntax. However, `MODEL_PRESETS` entries have the following structure:
```python
    "qwen2.5-0.5b": {
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "ram_mb": 600,
        "quality": 1,
        "context": 4096,
    }
```
The dataclass `LLMConfig` has fields:
```python
@dataclass
class LLMConfig:
    model_name: str = "qwen2.5-0.5b"
    n_ctx: int = 4096
    n_gpu_layers: int = 0
    n_threads: int | None = None
    temperature: float = 0.7
    max_tokens: int = 2048
```
Since `cfg` has keys (`filename`, `url`, `ram_mb`, `quality`, `context`) that do not match the expected parameters of `LLMConfig`, Python raises a `TypeError` for unexpected keyword arguments.
