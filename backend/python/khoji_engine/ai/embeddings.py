"""Embeddings module using sentence-transformers.

Uses all-MiniLM-L6-v2 (80MB, 384-dim) for CPU-friendly embeddings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@dataclass
class EmbeddingState:
    loaded: bool = False
    model_name: str = ""
    error: str = ""


class Embedder:
    """Sentence-transformer embeddings."""

    def __init__(self) -> None:
        self.state = EmbeddingState()
        self._model = None

    def load(self) -> bool:
        if self._model is not None:
            return True

        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(MODEL_NAME)
            self.state.loaded = True
            self.state.model_name = MODEL_NAME
            return True
        except Exception as e:
            self.state.error = f"Load failed: {e}"
            logger.error("Embedding model load failed: %s", e)
            return False

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts."""
        if not self.load():
            return [[] for _ in texts]

        try:

            embeddings = self._model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
            return embeddings.tolist()
        except Exception as e:
            logger.error("Embedding failed: %s", e)
            return [[] for _ in texts]

    def embed_one(self, text: str) -> list[float]:
        """Embed a single text."""
        results = self.embed([text])
        return results[0] if results else []

    def is_loaded(self) -> bool:
        return self._model is not None

    def get_info(self) -> dict:
        return {
            "model_name": self.state.model_name,
            "dimension": EMBEDDING_DIM,
            "loaded": self.state.loaded,
            "error": self.state.error,
        }


# ── Singleton ───────────────────────────────────────────────────
_default_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _default_embedder
    if _default_embedder is None:
        _default_embedder = Embedder()
    return _default_embedder
