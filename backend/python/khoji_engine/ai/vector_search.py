"""FAISS vector search engine.

Provides semantic search over document chunks using FAISS + sentence-transformers.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

import faiss
import numpy as np

from khoji_engine.ai.embeddings import EMBEDDING_DIM, get_embedder

logger = logging.getLogger(__name__)


class VectorStore:
    """FAISS-backed vector store for document chunks."""

    def __init__(self, store_path: Path | str | None = None) -> None:
        self.store_path = Path(store_path) if isinstance(store_path, str) else store_path or Path.home() / ".khoji" / "vectors"
        self.store_path.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._index: faiss.IndexFlatIP | None = None
        self._chunk_ids: list[str] = []
        self._metadata: list[dict] = []
        self._load_or_create()

    def _load_or_create(self) -> None:
        index_path = self.store_path / "vectors.index"
        meta_path = self.store_path / "metadata.json"

        if index_path.exists() and meta_path.exists():
            try:
                self._index = faiss.read_index(str(index_path))
                with open(meta_path) as f:
                    data = json.load(f)
                self._chunk_ids = data.get("chunk_ids", [])
                self._metadata = data.get("metadata", [])
                logger.info("Loaded vector store: %d vectors", self._index.ntotal)
                return
            except Exception as e:
                logger.warning("Failed to load vector store: %s", e)

        self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self._chunk_ids = []
        self._metadata = []

    def add_vectors(
        self,
        chunk_ids: list[str],
        embeddings: list[list[float]],
        metadata: list[dict] | None = None,
    ) -> None:
        """Add vectors to the store."""
        if not embeddings or not self._index:
            return

        vectors = np.array(embeddings, dtype=np.float32)
        faiss.normalize_L2(vectors)

        with self._lock:
            self._index.add(vectors)
            self._chunk_ids.extend(chunk_ids)

            if metadata:
                self._metadata.extend(metadata)
            else:
                self._metadata.extend([{} for _ in chunk_ids])

            self._save()

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Semantic search over all vectors."""
        if not self._index or self._index.ntotal == 0:
            return []

        embedder = get_embedder()
        query_vec = embedder.embed_one(query)
        if not query_vec:
            return []

        query_np = np.array([query_vec], dtype=np.float32)
        faiss.normalize_L2(query_np)

        k = min(limit, self._index.ntotal)
        distances, indices = self._index.search(query_np, k)

        results: list[dict] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self._chunk_ids):
                continue
            results.append(
                {
                    "chunk_id": self._chunk_ids[idx],
                    "score": float(dist),
                    "metadata": self._metadata[idx] if idx < len(self._metadata) else {},
                }
            )

        return results

    def remove_document(self, doc_id: str) -> int:
        """Remove all vectors for a document. Returns count removed."""
        if not self._index:
            return 0

        with self._lock:
            keep_mask = [m.get("doc_id") != doc_id for m in self._metadata]
            removed = sum(1 for k in keep_mask if not k)

            if removed == 0:
                return 0

            keep_indices = [i for i, k in enumerate(keep_mask) if k]

            new_ids = [self._chunk_ids[i] for i in keep_indices]
            new_meta = [self._metadata[i] for i in keep_indices]

            if keep_indices:
                vectors = np.array(
                    [self._index.reconstruct(i) for i in keep_indices], dtype=np.float32
                )
                self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
                self._index.add(vectors)
            else:
                self._index = faiss.IndexFlatIP(EMBEDDING_DIM)

            self._chunk_ids = new_ids
            self._metadata = new_meta
            self._save()

        return removed

    def _save(self) -> None:
        if not self._index:
            return

        try:
            faiss.write_index(self._index, str(self.store_path / "vectors.index"))
            with open(self.store_path / "metadata.json", "w") as f:
                json.dump(
                    {"chunk_ids": self._chunk_ids, "metadata": self._metadata},
                    f,
                )
        except Exception as e:
            logger.error("Failed to save vector store: %s", e)

    def get_stats(self) -> dict:
        return {
            "total_vectors": self._index.ntotal if self._index else 0,
            "dimension": EMBEDDING_DIM,
            "store_path": str(self.store_path),
        }


# ── Singleton ───────────────────────────────────────────────────
_default_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _default_store
    if _default_store is None:
        _default_store = VectorStore()
    return _default_store
