"""
Khoji AI Engine - Entry point for Python subprocess.
Communicates with Rust/Tauri via JSON over stdin/stdout.
"""
import sys
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("khoji-engine")

ENGINE_VERSION = "1.0.0"


STREAMING_ACTIONS = {"chat_stream", "process_document_stream"}


def handle_message(msg: dict) -> dict:
    from khoji_engine.handlers import ACTION_HANDLERS

    action = msg.get("action", "")
    payload = msg.get("payload", {})

    logger.info(f"Handling action: {action}")

    handler = ACTION_HANDLERS.get(action)
    if handler is None:
        return {"status": "error", "error": f"Unknown action: {action}"}
    try:
        return handler(payload)
    except Exception as e:
        logger.exception("Action '%s' failed", action)
        return {"status": "error", "error": str(e)}


def handle_streaming(msg: dict) -> None:
    """Handle a streaming action — writes multiple NDJSON lines to stdout."""
    from khoji_engine.handlers import STREAM_HANDLERS

    action = msg.get("action", "")
    payload = msg.get("payload", {})

    logger.info(f"Handling streaming action: {action}")

    def emit(obj: dict) -> None:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

    handler = STREAM_HANDLERS.get(action)
    if handler is None:
        emit({"type": "error", "error": f"Unknown streaming action: {action}"})
        return
    try:
        handler(payload, emit)
    except Exception as e:
        logger.exception("Streaming action '%s' failed", action)
        emit({"type": "error", "error": str(e)})


def main():
    logger.info("Khoji AI Engine starting...")

    # Start pre-warming embedding model in a background thread
    import threading
    from khoji_engine.ai.embeddings import get_embedder
    def pre_warm():
        try:
            logger.info("Pre-warming embedding model in background thread...")
            get_embedder().load()
            logger.info("Embedding model pre-warmed successfully.")
        except Exception:
            logger.exception("Pre-warming embedding model failed")
            
    threading.Thread(target=pre_warm, daemon=True).start()

    sys.stdout.write(json.dumps({"type": "ready", "version": ENGINE_VERSION}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            action = msg.get("action", "")
            if action in STREAMING_ACTIONS:
                handle_streaming(msg)
            else:
                response = handle_message(msg)
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({"status": "error", "error": f"Invalid JSON: {e}"}) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.exception("Unhandled error")
            sys.stdout.write(json.dumps({"status": "error", "error": str(e)}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
