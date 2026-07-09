# Handoff Report — challenger_backend_1

## 1. Observation
Running the verification command:
```bash
cd "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python"
PYTHONPATH=. python3 verify_ipc.py
```
Resulted in the following terminal output:
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
We inspected the following source files:
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/main.py` lines 174-182:
  ```python
  elif action == "download_model":
      from khoji_engine.ai.llm import get_llm, MODEL_PRESETS, LocalLLM, LLMConfig
      model_id = payload.get("model_id", "")
      cfg = MODEL_PRESETS.get(model_id)
      if not cfg:
          return {"status": "error", "error": f"Unknown model: {model_id}"}
      llm = LocalLLM(LLMConfig(**cfg))
  ```
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/ai/llm.py` lines 19-33:
  ```python
  MODEL_PRESETS: dict[str, dict] = {
      "qwen2.5-0.5b": {
          "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
          "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
          "ram_mb": 500,
          "quality": 1,
          "context": 4096,
      },
  ```
- `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python/khoji_engine/ai/llm.py` lines 51-59:
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

## 2. Logic Chain
1. The action `"download_model"` triggers a call to `LLMConfig(**cfg)` (from main.py line 180).
2. The dictionary `cfg` is fetched from `MODEL_PRESETS` for `"qwen2.5-0.5b"` (from main.py line 177).
3. The dictionary contains keys `filename`, `url`, `ram_mb`, `quality`, and `context`.
4. Dataclass `LLMConfig` lacks fields for `filename`, `url`, `ram_mb`, `quality`, and `context`.
5. Therefore, unpacking `cfg` passing those keys as arguments causes `LLMConfig.__init__()` to fail with a `TypeError`.

## 3. Caveats
- No caveats. The issue is clear, deterministic, and 100% reproducible.

## 4. Conclusion
The implementation of the `download_model` action in `khoji_engine/main.py` is broken. The implementer must fix the instantiation of `LLMConfig` to only pass fields defined on `LLMConfig` (e.g. mapping `model_id` to `model_name` and `context` to `n_ctx`).

## 5. Verification Method
1. Run the test command:
   ```bash
   cd "/home/sourav/Project/OSDHack 2026 hackathon/hackathon/backend/python"
   PYTHONPATH=. python3 verify_ipc.py
   ```
2. The command should exit with status code 0 and output:
   `All IPC actions verified successfully!`
