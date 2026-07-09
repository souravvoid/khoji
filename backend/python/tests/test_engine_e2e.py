"""
Real engine end-to-end test.

Launches the actual Khoji Python engine as a subprocess — exactly the way the
Rust/Tauri backend does — and drives it over the line-delimited JSON protocol on
stdin/stdout. This exercises the real pipeline (PDF extraction, markdown,
embeddings + vector search, rule-based flashcards/quiz, DB persistence, export)
rather than the mocked IPC used by the browser UI tests.

Only the LLM-backed actions (chat / timeline / mindmap) are skipped here because
they require a downloaded GGUF model; everything tested below is fully real.

The engine uses ~/.cache/huggingface for the embedding model (downloaded once,
then cached) and an isolated temp HOME for the database, so runs do not pollute
the developer's real data.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import fitz  # PyMuPDF
import pytest

ENGINE_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ENGINE_DIR / ".venv" / "bin" / "python"
FIXTURE_TEXT = (
    "Khoji is an offline AI knowledge workspace. "
    "The Roman Republic was founded in 509 BC. "
    "Julius Caesar crossed the Rubicon in 49 BC. "
    "Quantum superposition lets a qubit hold both states until measured."
)


def make_fixture_pdf(path: Path) -> None:
    doc = fitz.open()
    for _ in range(2):
        page = doc.new_page()
        page.insert_text((72, 72), FIXTURE_TEXT, fontsize=12)
    doc.save(str(path))
    doc.close()


class EngineProcess:
    """Wraps the real engine subprocess and the stdio JSON protocol."""

    def __init__(self, env: dict[str, str]):
        self.proc = subprocess.Popen(
            [str(VENV_PYTHON), "-u", "-m", "khoji_engine.main"],
            cwd=str(ENGINE_DIR),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._wait_ready()

    def _wait_ready(self, timeout: float = 300) -> None:
        deadline = time.time() + timeout
        assert self.proc.stdout is not None
        while time.time() < deadline:
            line = self.proc.stdout.readline()
            if not line:
                if self.proc.poll() is not None:
                    raise RuntimeError("Engine exited before ready")
                continue
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ready":
                return
        raise TimeoutError("Engine did not become ready in time")

    def send(self, action: str, payload: dict, timeout: float = 300) -> dict:
        assert self.proc.stdin is not None and self.proc.stdout is not None
        self.proc.stdin.write(json.dumps({"action": action, "payload": payload}) + "\n")
        self.proc.stdin.flush()
        deadline = time.time() + timeout
        while time.time() < deadline:
            line = self.proc.stdout.readline()
            if not line:
                if self.proc.poll() is not None:
                    raise RuntimeError("Engine exited mid-request")
                continue
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "status" in msg:
                return msg
        raise TimeoutError(f"No response for action '{action}'")

    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()


@pytest.fixture()
def engine():
    tmp = tempfile.mkdtemp(prefix="khoji-e2e-")
    home = Path(tmp) / "home"
    home.mkdir()
    pdf = Path(tmp) / "fixture.pdf"
    make_fixture_pdf(pdf)

    env = dict(os.environ)
    env["HOME"] = str(home)
    proc = EngineProcess(env)
    try:
        yield proc, pdf
    finally:
        proc.close()
        shutil.rmtree(tmp, ignore_errors=True)


def test_ping(engine):
    proc, _ = engine
    res = proc.send("ping", {})
    assert res["status"] == "ok"
    assert res["result"] == "pong"


def test_process_real_document(engine):
    proc, pdf = engine
    res = proc.send("process_document", {"file_path": str(pdf)})
    assert res["status"] == "ok", res
    result = res["result"]
    assert result["success"] is True
    assert result["page_count"] == 2
    assert result["flashcard_count"] > 0
    assert result["quiz_count"] > 0
    doc_id = result["doc_id"]

    # Document is persisted and retrievable
    got = proc.send("get_document", {"doc_id": doc_id})
    assert got["status"] == "ok"
    assert got["result"]["title"]

    listing = proc.send("get_documents", {})
    assert listing["status"] == "ok"
    assert any(d["id"] == doc_id for d in listing["result"])

    # Real vector search finds the processed document by content
    search = proc.send("search", {"query": "Roman Republic", "limit": 5})
    assert search["status"] == "ok", search
    assert len(search["result"]) > 0
    assert any("Roman" in (r.get("content") or "") for r in search["result"])

    # Rule-based cards/quiz generated from the real text
    cards = proc.send("generate_flashcards", {"doc_id": doc_id})
    assert cards["status"] == "ok"
    assert len(cards["result"]) > 0

    quiz = proc.send("generate_quiz", {"doc_id": doc_id})
    assert quiz["status"] == "ok"
    assert len(quiz["result"]) > 0

    # Export produces real markdown
    export = proc.send("export_document", {"doc_id": doc_id, "format": "markdown"})
    assert export["status"] == "ok"
    assert "Khoji" in export["result"]["content"]

    # Deletion removes it from the store
    deleted = proc.send("delete_document", {"doc_id": doc_id})
    assert deleted["status"] == "ok"
    assert deleted["result"]["deleted"] is True
    after = proc.send("get_document", {"doc_id": doc_id})
    assert after["status"] == "ok"
    assert after["result"] is None
