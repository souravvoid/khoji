#!/usr/bin/env python3
"""
Clean Khoji build artifacts.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DIRS_TO_CLEAN = [
    "frontend/dist",
    "frontend/src-tauri/target",
    "frontend/node_modules",
    "backend/python/.venv",
    "backend/python/__pycache__",
    "backend/python/**/__pycache__",
    ".ruff_cache",
    ".pytest_cache",
]

FILES_TO_CLEAN = [
    "frontend/src-tauri/target",
]

def main():
    print("Cleaning Khoji build artifacts...")

    for pattern in DIRS_TO_CLEAN:
        for path in sorted(ROOT.glob(pattern)):
            if path.is_dir():
                print(f"  Removing: {path.relative_to(ROOT)}")
                shutil.rmtree(path, ignore_errors=True)
            elif path.is_file():
                path.unlink()

    # Also clean __pycache__ recursively
    for pycache in ROOT.rglob("__pycache__"):
        if pycache.is_dir():
            shutil.rmtree(pycache, ignore_errors=True)

    # Clean .egg-info
    for egg_info in ROOT.rglob("*.egg-info"):
        if egg_info.is_dir():
            shutil.rmtree(egg_info, ignore_errors=True)

    print("Done.")


if __name__ == "__main__":
    main()
