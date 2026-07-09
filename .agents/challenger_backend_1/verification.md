# Verification Report

- **Date**: 2026-07-07
- **Target**: `backend/python/verify_ipc.py`
- **Status**: **FAILED** (Exit code: 1)

## Summary of Findings

During execution of the verification script `verify_ipc.py`, the test suite failed at action **11** (`download_model`). The traceback indicates a `TypeError` due to passing invalid/unexpected keyword arguments to `LLMConfig.__init__()`.

## Execution Log

```
Starting verification of IPC actions...
2026-07-07 17:29:43,691 [INFO] khoji-engine: Handling action: ping
✓ ping passed
2026-07-07 17:29:43,692 [INFO] khoji-engine: Handling action: process_document
✓ process_document passed (doc_id: f079a4d1-507b-4e8e-9b9e-8828e71e21b9)
2026-07-07 17:29:43,695 [INFO] khoji-engine: Handling action: search
✓ search passed
2026-07-07 17:29:43,695 [INFO] khoji-engine: Handling action: generate_flashcards
✓ generate_flashcards passed
2026-07-07 17:29:43,700 [INFO] khoji-engine: Handling action: generate_quiz
✓ generate_quiz passed
2026-07-07 17:29:43,702 [INFO] khoji-engine: Handling action: get_documents
✓ get_documents passed
2026-07-07 17:29:43,703 [INFO] khoji-engine: Handling action: get_document
✓ get_document passed
2026-07-07 17:29:43,704 [INFO] khoji-engine: Handling action: export_document
✓ export_document passed
2026-07-07 17:29:43,710 [INFO] khoji-engine: Handling action: get_models
✓ get_models passed
2026-07-07 17:29:43,712 [INFO] khoji-engine: Handling action: get_chat_history
✓ get_chat_history passed
2026-07-07 17:29:43,713 [INFO] khoji-engine: Handling action: download_model
Traceback (most recent call last):
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/verify_ipc.py", line 246, in <module>
    run_tests()
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/verify_ipc.py", line 176, in run_tests
    res = handle_message({"action": "download_model", "payload": {"model_id": "qwen2.5-0.5b"}})
  File "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/main.py", line 180, in handle_message
    llm = LocalLLM(LLMConfig(**cfg))
TypeError: LLMConfig.__init__() got an unexpected keyword argument 'filename'
```

## Detailed Analysis

### Root Cause
In `khoji_engine/main.py` line 180:
```python
llm = LocalLLM(LLMConfig(**cfg))
```
The variable `cfg` is populated via:
```python
cfg = MODEL_PRESETS.get(model_id)
```
Where `MODEL_PRESETS` in `khoji_engine/ai/llm.py` defines presets with keys: `filename`, `url`, `ram_mb`, `quality`, `context`.
However, `LLMConfig` is a dataclass defined as:
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
Since `LLMConfig` has no fields named `filename`, `url`, `ram_mb`, `quality`, or `context`, unpacking `cfg` as keyword arguments (`**cfg`) fails with:
`TypeError: LLMConfig.__init__() got an unexpected keyword argument 'filename'`

### Suggested Mitigation (for the Implementer)
In `khoji_engine/main.py` around line 180, instantiate `LLMConfig` using only valid fields or construct it directly, e.g.:
```python
        cfg = MODEL_PRESETS.get(model_id)
        if not cfg:
            return {"status": "error", "error": f"Unknown model: {model_id}"}
        
        # Instantiate LLMConfig with valid parameters
        llm_config = LLMConfig(
            model_name=model_id,
            n_ctx=cfg.get("context", 4096)
        )
        llm = LocalLLM(llm_config)
```
