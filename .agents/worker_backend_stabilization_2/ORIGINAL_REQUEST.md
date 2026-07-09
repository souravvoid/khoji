## 2026-07-07T12:00:00Z
You are teamwork_preview_worker.
Your working directory is: /home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/worker_backend_stabilization_2

DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.

Please fix a bug in `backend/python/khoji_engine/main.py`:
In the `download_model` handler:
```python
    elif action == "download_model":
        from khoji_engine.ai.llm import get_llm, MODEL_PRESETS, LocalLLM, LLMConfig
        model_id = payload.get("model_id", "")
        cfg = MODEL_PRESETS.get(model_id)
        if not cfg:
            return {"status": "error", "error": f"Unknown model: {model_id}"}
        llm = LocalLLM(LLMConfig(**cfg)) # BUG: cfg has extra/different parameters
        llm.ensure_model()
```
Change it to pass the correct parameters to `LLMConfig` like:
```python
        config = LLMConfig(model_name=model_id, n_ctx=cfg.get("context", 4096))
        llm = LocalLLM(config)
```

Once fixed:
1. Run `PYTHONPATH=. python3 verify_ipc.py` inside `backend/python/` to verify that all 18 IPC endpoints now return status ok and pass all assertions.
2. Confirm the exact output.

Write a detailed handoff report to `/home/sourav/Project/OSDHack 2026 hackathon/hackathon/.agents/worker_backend_stabilization_2/handoff.md` and send a message back.
