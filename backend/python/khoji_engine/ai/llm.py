"""Local LLM integration via llama-cpp-python.

Supports Qwen2.5-1.5B, SmolLM2-1.7B, TinyLlama-1.1B.
Auto-selects best model for available hardware.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)

GGUF_DIR = Path.home() / ".khoji" / "models"

BYTES_PER_MB = 1024 * 1024
FALLBACK_RAM_MB = 4096
RAM_HEADROOM_FACTOR = 1.5
MIN_CTX_TOKENS = 2048
DEFAULT_CPU_THREADS = 4
MIN_CPU_THREADS = 2

MODEL_PRESETS: dict[str, dict] = {
    "qwen2.5-0.5b": {
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "ram_mb": 500,
        "quality": 1,
        "context": 4096,
    },
    "qwen2.5-1.5b": {
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "ram_mb": 1200,
        "quality": 3,
        "context": 4096,
    },
    "smollm2-1.7b": {
        "filename": "SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
        "url": "https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
        "ram_mb": 1400,
        "quality": 3,
        "context": 4096,
    },
    "tinyllama-1.1b": {
        "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        "url": "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        "ram_mb": 900,
        "quality": 2,
        "context": 2048,
    },
}


@dataclass
class LLMConfig:
    model_name: str = "qwen2.5-0.5b"
    n_ctx: int = 4096
    n_gpu_layers: int = 0
    n_threads: int | None = None
    temperature: float = 0.7
    max_tokens: int = 2048


@dataclass
class LLMState:
    loaded: bool = False
    model_name: str = ""
    model_path: str = ""
    error: str = ""
    ram_mb: int = 0


class LocalLLM:
    """Wrapper around llama-cpp-python for local inference."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()
        self.state = LLMState()
        self._llm = None

    def detect_hardware(self) -> LLMConfig:
        """Auto-detect best model for available RAM/GPU."""
        try:
            import psutil

            available_mb = psutil.virtual_memory().available / BYTES_PER_MB
        except ImportError:
            available_mb = FALLBACK_RAM_MB

        best = "tinyllama-1.1b"
        best_quality = MODEL_PRESETS[best]["quality"]
        for name, preset in MODEL_PRESETS.items():
            if available_mb > preset["ram_mb"] * RAM_HEADROOM_FACTOR and preset["quality"] > best_quality:
                best = name
                best_quality = preset["quality"]

        cfg = LLMConfig(model_name=best)
        if available_mb < MIN_CTX_TOKENS:
            cfg.n_ctx = MIN_CTX_TOKENS
        return cfg

    def ensure_model(self, progress_callback=None) -> bool:
        """Download the model file if not present."""
        preset = MODEL_PRESETS.get(self.config.model_name)
        if not preset:
            self.state.error = f"Unknown model: {self.config.model_name}"
            return False

        GGUF_DIR.mkdir(parents=True, exist_ok=True)
        model_path = GGUF_DIR / preset["filename"]

        if model_path.exists():
            self.state.model_path = str(model_path)
            return True

        logger.info("Downloading %s ...", preset["filename"])
        if progress_callback:
            progress_callback(f"Downloading {preset['filename']}...")

        try:
            import urllib.request

            urllib.request.urlretrieve(preset["url"], str(model_path))
            self.state.model_path = str(model_path)
            return True
        except Exception as e:
            self.state.error = f"Download failed: {e}"
            logger.error("Model download failed: %s", e)
            return False

    def load(self) -> bool:
        """Load the model into memory."""
        if self._llm is not None:
            return True

        if not self.state.model_path:
            if not self.ensure_model():
                return False

        try:
            from llama_cpp import Llama

            n_threads = self.config.n_threads or max(1, (os.cpu_count() or DEFAULT_CPU_THREADS) - MIN_CPU_THREADS)
            self._llm = Llama(
                model_path=self.state.model_path,
                n_ctx=self.config.n_ctx,
                n_gpu_layers=self.config.n_gpu_layers,
                n_threads=n_threads,
                verbose=False,
            )
            self.state.loaded = True
            self.state.model_name = self.config.model_name
            return True
        except Exception as e:
            self.state.error = f"Load failed: {e}"
            logger.error("LLM load failed: %s", e)
            return False

    def generate(self, prompt: str, *, system: str = "", temperature: float | None = None) -> str:
        """Generate a completion."""
        if not self.load():
            return f"[Error: {self.state.error}]"

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self._llm.create_chat_completion(
                messages=messages,
                temperature=temperature or self.config.temperature,
                max_tokens=self.config.max_tokens,
            )
            return response["choices"][0]["message"]["content"] or ""
        except Exception as e:
            logger.error("Generation failed: %s", e)
            return f"[Error: {e}]"

    def generate_stream(self, prompt: str, *, system: str = "", history: list[dict] | None = None) -> Iterator[str]:
        """Generate a completion with streaming. ``history`` is a list of
        ``{"role": "user"|"assistant", "content": ...}`` turns prepended
        before the current prompt for multi-turn chat."""
        if not self.load():
            yield f"[Error: {self.state.error}]"
            return

        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        try:
            stream = self._llm.create_chat_completion(
                messages=messages,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                stream=True,
            )
            for chunk in stream:
                delta = chunk["choices"][0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield content
        except Exception as e:
            logger.error("Stream failed: %s", e)
            yield f"[Error: {e}]"

    def is_loaded(self) -> bool:
        return self._llm is not None

    def unload(self) -> None:
        self._llm = None
        self.state.loaded = False

    def get_info(self) -> dict:
        return {
            "model_name": self.state.model_name,
            "model_path": self.state.model_path,
            "loaded": self.state.loaded,
            "ram_mb": self.state.ram_mb,
            "error": self.state.error,
        }


# ── Singleton ───────────────────────────────────────────────────
_default_llm: LocalLLM | None = None


def get_llm() -> LocalLLM:
    global _default_llm
    if _default_llm is None:
        probe = LocalLLM()
        try:
            # ponytail: auto-select model by available RAM on first init
            llm = LocalLLM(probe.detect_hardware())
        except Exception as e:
            logger.warning("Hardware detection failed, using default model: %s", e)
            llm = probe
        # ponytail: a cached GGUF can be corrupt/incomplete; fall back to
        # any other cached model that actually loads so chat never dies.
        if not llm.load():
            logger.warning("Selected model failed to load; trying fallbacks")
            for name in MODEL_PRESETS:
                if name == llm.config.model_name:
                    continue
                cand = LocalLLM(LLMConfig(model_name=name))
                if cand.load():
                    llm = cand
                    break
        _default_llm = llm
    return _default_llm


def set_model(model_name: str) -> bool:
    global _default_llm
    if model_name not in MODEL_PRESETS:
        return False
    preset = MODEL_PRESETS[model_name]
    _default_llm = LocalLLM(LLMConfig(model_name=model_name, n_ctx=preset.get("context", 4096)))
    model_path = GGUF_DIR / preset["filename"]
    if model_path.exists():
        _default_llm.state.model_path = str(model_path)
    return True
