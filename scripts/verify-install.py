#!/usr/bin/env python3
"""
Verify Khoji installation.
Checks that all dependencies and models are in place.
"""

import importlib
import shutil
import sys
from pathlib import Path

REQUIRED_PYTHON_PACKAGES = [
    "PyMuPDF",
    "numpy",
    "sentence_transformers",
    "faiss",
]

OPTIONAL_PACKAGES = [
    ("python-docx", "docx"),
    ("python-pptx", "pptx"),
    ("EbookLib", "ebooklib"),
    ("rapidocr-onnxruntime", "rapidocr_onnxruntime"),
]

MODELS_DIR = Path.home() / ".khoji" / "models"
EXPECTED_MODELS = {
    "qwen2.5-0.5b-instruct-q4_k_m.gguf": "LLM (500 MB)",
    "qwen2.5-1.5b-instruct-q4_k_m.gguf": "LLM (1.2 GB)",
    "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf": "LLM (900 MB)",
}

CHECKS_PASSED = 0
CHECKS_FAILED = 0


def check(description: str, ok: bool) -> None:
    global CHECKS_PASSED, CHECKS_FAILED
    if ok:
        print(f"  ✓ {description}")
        CHECKS_PASSED += 1
    else:
        print(f"  ✗ {description}")
        CHECKS_FAILED += 1


def main():
    global CHECKS_PASSED, CHECKS_FAILED
    print(f"Python:          {sys.version}")
    print(f"Platform:        {sys.platform}")
    print()

    # ── Python Dependencies ──
    print("--- Python Packages ---")
    for pkg in REQUIRED_PYTHON_PACKAGES:
        try:
            importlib.import_module(pkg.replace("-", "_").replace(".", ""))
            check(pkg, True)
        except ImportError:
            try:
                importlib.import_module(pkg.lower().replace("-", "_"))
                check(pkg, True)
            except ImportError:
                check(pkg, False)

    for pkg_name, mod_name in OPTIONAL_PACKAGES:
        try:
            importlib.import_module(mod_name)
            check(f"{pkg_name} (optional)", True)
        except ImportError:
            check(f"{pkg_name} (optional)", False)

    # ── External Tools ──
    print()
    print("--- External Tools ---")
    check("tesseract (optional OCR)", shutil.which("tesseract") is not None)

    # ── AI Models ──
    print()
    print("--- AI Models ---")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for model_file, desc in EXPECTED_MODELS.items():
        model_path = MODELS_DIR / model_file
        if model_path.exists():
            size_mb = model_path.stat().st_size / (1024 * 1024)
            check(f"{desc} ({size_mb:.0f} MB)", True)
        else:
            check(f"{desc} - not found", False)

    # ── Project Structure ──
    print()
    print("--- Project Structure ---")
    script_dir = Path(__file__).resolve().parent.parent
    check("frontend/ exists", (script_dir / "frontend").is_dir())
    check("backend/ exists", (script_dir / "backend").is_dir())
    check("backend/python/khoji_engine/main.py exists", (script_dir / "backend" / "python" / "khoji_engine" / "main.py").is_file())
    check("frontend/src-tauri/ exists", (script_dir / "frontend" / "src-tauri").is_dir())
    check("scripts/ exists", (script_dir / "scripts").is_dir())

    # ── Build Output (if present) ──
    dist_dir = script_dir / "frontend" / "dist"
    if dist_dir.is_dir():
        check("frontend/dist/ exists (build present)", True)

    print()
    print(f"Results: {CHECKS_PASSED} passed, {CHECKS_FAILED} failed")
    return 0 if CHECKS_FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
