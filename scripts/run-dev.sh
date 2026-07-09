#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Khoji Dev Runner ==="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found"
    exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
    echo "ERROR: node not found"
    exit 1
fi

# Install Python deps if needed
if [ ! -d "backend/python/.venv" ]; then
    echo ">>> Setting up Python virtual environment..."
    cd backend/python
    python3 -m venv .venv
    .venv/bin/pip install -e ".[dev]" 2>/dev/null || .venv/bin/pip install PyMuPDF numpy sentence-transformers faiss-cpu
    cd "$ROOT"
fi

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
    echo ">>> Installing frontend dependencies..."
    cd frontend
    npm install
    cd "$ROOT"
fi

echo ">>> Starting Khoji in development mode..."
echo "    Frontend: Vite dev server (port 5173)"
echo "    Backend:  Tauri + Python subprocess"
echo ""

cd frontend
npx tauri dev
