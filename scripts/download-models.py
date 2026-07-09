#!/usr/bin/env python3
"""
Download AI models for Khoji.
Downloads the default lightweight models suitable for Intel i5 12th Gen + 8GB RAM.
"""

import argparse
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path.home() / ".khoji" / "models"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

LLM_MODELS = {
    "qwen2.5-0.5b": {
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "size_mb": 500,
    },
    "qwen2.5-1.5b": {
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size_mb": 1200,
    },
    "tinyllama-1.1b": {
        "filename": "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        "url": "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        "size_mb": 900,
    },
}

def download_file(url: str, dest: Path, desc: str = "") -> None:
    print(f"Downloading {desc or dest.name}...")
    print(f"  From: {url}")
    print(f"  To:   {dest}")

    def progress(block: int, bs: int, total: int):
        if total > 0:
            pct = min(100, block * bs * 100 // total)
            bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
            sys.stdout.write(f"\r  [{bar}] {pct}% ({block * bs // 1024 // 1024}MB / {total // 1024 // 1024}MB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, str(dest), reporthook=progress)
    print()
    print(f"  ✓ Saved: {dest} ({dest.stat().st_size / 1024 / 1024:.0f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Download AI models for Khoji")
    parser.add_argument("--llm", choices=list(LLM_MODELS.keys()) + ["all"], default="qwen2.5-0.5b",
                        help="LLM model to download (default: qwen2.5-0.5b)")
    parser.add_argument("--skip-embedding", action="store_true", help="Skip embedding model download")
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    total_mb = 0

    # Download embedding model via sentence-transformers (will cache automatically)
    if not args.skip_embedding:
        print(f"\n=== Embedding Model: {EMBEDDING_MODEL} ===")
        print("(Downloads automatically on first use via sentence-transformers)")
        try:
            from sentence_transformers import SentenceTransformer
            print("Loading embedding model...")
            model = SentenceTransformer(EMBEDDING_MODEL)
            print(f"  ✓ Embedding model loaded ({EMBEDDING_MODEL})")
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            print("  Run: pip install sentence-transformers")
    else:
        print("Skipping embedding model.")

    # Download LLM model
    models_to_dl = [args.llm] if args.llm != "all" else list(LLM_MODELS.keys())

    for model_id in models_to_dl:
        info = LLM_MODELS[model_id]
        dest = MODELS_DIR / info["filename"]
        total_mb += info["size_mb"]

        if dest.exists():
            print(f"\n=== LLM: {model_id} ===")
            print(f"  ✓ Already exists: {dest} ({dest.stat().st_size / 1024 / 1024:.0f} MB)")
            continue

        print(f"\n=== LLM: {model_id} ({info['size_mb']} MB) ===")
        download_file(info["url"], dest, model_id)

    print(f"\n{'='*50}")
    print(f"Total download size: ~{total_mb} MB")
    print(f"Models directory:    {MODELS_DIR}")
    print()
    print("To verify: python scripts/verify-install.py")
    print("To run:    bash scripts/run-dev.sh")


if __name__ == "__main__":
    main()
