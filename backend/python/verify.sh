#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }

run_step() {
    local label="$1" cmd="$2"
    printf "\n── %s\n" "$label"
    if eval "$cmd" 2>&1; then
        pass "$label"
    else
        fail "$label"
        return 1
    fi
}

echo "╔══════════════════════════════════════╗"
echo "║   Khoji Backend Verification Suite   ║"
echo "╚══════════════════════════════════════╝"

run_step "ruff lint"    "uv run ruff check khoji_engine/" || true
run_step "import smoke" "uv run python -c 'import khoji_engine.main; import khoji_engine.handlers; import khoji_engine.pipeline.processor'" || true
run_step "IPC verify"   "uv run python verify_ipc.py" || true
run_step "engine E2E"   "uv run pytest tests/ -v" || true

printf "\n══ Results: %d passed, %d failed ══\n" "$PASS" "$FAIL"
if (( FAIL > 0 )); then
    exit 1
fi
