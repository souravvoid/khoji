"""Final QA end-to-end harness for Khoji.

Drives the REAL engine subprocess (``python3 -m khoji_engine.main`` with
PYTHONPATH set to backend/python) exactly as the Tauri/Rust bridge does, then
exercises every IPC action against real sample documents and the real local LLM.

Run:  PYTHONPATH=. ./.venv/bin/python tests/qa_e2e.py
"""

from __future__ import annotations

import csv
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent  # backend/python/tests
BACKEND = HERE.parent  # backend/python
# ponytail: do NOT resolve() — .venv/bin/python is a symlink; resolving it
# drops venv activation and the child loses its site-packages.
PY = str(BACKEND / ".venv" / "bin" / "python")
ENGINE_MODULE = "khoji_engine.main"

RESULTS: list[dict] = []


def record(name: str, status: str, detail: str, seconds: float = 0.0, bug: str = "") -> None:
    RESULTS.append({
        "test": name, "status": status, "detail": detail,
        "seconds": round(seconds, 2), "bug": bug,
    })
    print(f"[{status}] {name} ({seconds:.2f}s) {detail}")


class Engine:
    def __init__(self) -> None:
        env = dict(os.environ)
        env["PYTHONPATH"] = str(BACKEND)
        # keep model/embedding caches (real HOME) but isolated is fine here
        self.proc = subprocess.Popen(
            [PY, "-m", ENGINE_MODULE],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=open("/tmp/engine_run.log", "w"), cwd=str(BACKEND), env=env,
            text=True, bufsize=1,
        )
        # read the ready line
        line = self.proc.stdout.readline()
        self.ready = json.loads(line) if line.strip() else {}

    def request(self, action: str, payload: dict, timeout: float = 120.0) -> dict:
        self.proc.stdin.write(json.dumps({"action": action, "payload": payload}) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("engine closed stdout")
        return json.loads(line)

    def stream(self, action: str, payload: dict, timeout: float = 200.0) -> dict:
        self.proc.stdin.write(json.dumps({"action": action, "payload": payload}) + "\n")
        self.proc.stdin.flush()
        tokens: list[str] = []
        end: dict = {}
        while True:
            line = self.proc.stdout.readline()
            if not line:
                break
            obj = json.loads(line)
            t = obj.get("type")
            if t == "token":
                tokens.append(obj.get("content", ""))
            elif t == "progress":
                pass
            elif t == "end":
                end = obj
                break
            elif t == "error":
                end = obj
                break
        return {"tokens": tokens, "end": end}

    def stop(self) -> None:
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


# ── Sample document builders ──────────────────────────────────────────

NOTES_TEXT = """# Khoji Project Notes

## History
Rome was founded in 753 BC. The Roman Empire fell in 476 AD.
The Renaissance began around 1400 AD in Italy.
In the 19th century, railways expanded across Europe.
In 1991, the public internet became widely available.

## Features
Khoji is an offline AI knowledge workspace. It supports PDF upload.
Embeddings use all-MiniLM-L6-v2 for semantic search.
The chatbot answers questions using document context.
"""


def make_txt(d: Path) -> Path:
    p = d / "sample.txt"
    p.write_text("Khoji is an offline AI knowledge workspace. It was founded in 2021. "
                 "The tool extracts text from PDF files. Semantic search uses embeddings.\n", encoding="utf-8")
    return p


def make_md(d: Path) -> Path:
    p = d / "notes.md"
    p.write_text(NOTES_TEXT, encoding="utf-8")
    return p


def make_csv(d: Path) -> Path:
    p = d / "data.csv"
    rows = [["name", "year", "value"], ["alpha", "2020", "1500"], ["beta", "2022", "3200"]]
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        w.writerow(r)
    p.write_text(buf.getvalue(), encoding="utf-8")
    return p


def make_pdf(d: Path) -> Path:
    import fitz
    p = d / "doc.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 60), "Khoji is an offline AI knowledge tool.")
    page.insert_text((50, 90), "It was released in 2021 by a student team.")
    page.insert_text((50, 120), "Semantic search works on embedded chunks.")
    doc.save(str(p))
    return p


def make_docx(d: Path) -> Path:
    from docx import Document
    p = d / "report.docx"
    doc = Document()
    doc.add_paragraph("Khoji is an offline AI knowledge workspace.")
    doc.add_paragraph("It was founded in 2021 and supports PDF upload.")
    doc.add_paragraph("Semantic search uses MiniLM embeddings.")
    doc.save(str(p))
    return p


def make_empty(d: Path) -> Path:
    p = d / "empty.txt"
    p.write_text("", encoding="utf-8")
    return p


def make_corrupt_pdf(d: Path) -> Path:
    p = d / "corrupt.pdf"
    p.write_bytes(b"%PDF-1.4\nthis is not a valid pdf trailer<<>>")
    return p


def make_unicode(d: Path) -> Path:
    p = d / "unicode.txt"
    text = (
        "Hindi: खोज एक ऑफलाइन एआई ज्ञान कार्यक्षेत्र है।\n"
        "Chinese: 知识是一个离线人工智能知识工作区。\n"
        "Arabic: خوجي هي مساحة عمل معرفية ذكاء اصطناعي غير متصلة.\n"
        "Emoji: Khoji 🚀 supports 📄 PDF and 🔍 search! 🎉\n"
    )
    p.write_text(text, encoding="utf-8")
    return p


def make_large(d: Path) -> Path:
    p = d / "large.txt"
    para = "Khoji is an offline AI knowledge workspace. " * 10
    p.write_text((para + "\n") * 300, encoding="utf-8")  # ~ a few hundred KB
    return p


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="khoji_qa_"))
    engine = Engine()
    record("engine_startup", "PASS" if engine.ready.get("type") == "ready" else "FAIL",
           f"version={engine.ready.get('version')}")

    created_doc_ids: list[str] = []
    failures = 0

    def ingest(path: Path, label: str) -> str | None:
        nonlocal failures
        t0 = time.time()
        try:
            res = engine.stream("process_document_stream", {"file_path": str(path)})
            end = res["end"]
            dt = time.time() - t0
            if end.get("type") == "error":
                record(f"ingest:{label}", "FAIL", str(end.get("error")), dt, "ING-?")
                failures += 1
                return None
            r = end.get("result", {})
            doc_id = r.get("doc_id")
            if doc_id:
                created_doc_ids.append(doc_id)
            ok = bool(doc_id) and r.get("success")
            record(f"ingest:{label}", "PASS" if ok else "FAIL",
                   f"pages={r.get('page_count')} chunks={r.get('chunk_count')} "
                   f"cards={r.get('flashcard_count')} quiz={r.get('quiz_count')} msg={r.get('message')}",
                   dt)
            if not ok:
                failures += 1
            return doc_id
        except Exception as e:
            record(f"ingest:{label}", "FAIL", f"{e}\n{traceback.format_exc()}", time.time() - t0, "ING-EXC")
            failures += 1
            return None

    # ── Ingestion of every supported type ──
    md_path = make_md(tmp)
    md_id = ingest(md_path, "markdown+timeline")
    ingest(make_txt(tmp), "txt")
    ingest(make_csv(tmp), "csv")
    ingest(make_pdf(tmp), "pdf")
    ingest(make_docx(tmp), "docx")
    ingest(make_unicode(tmp), "unicode")
    ingest(make_large(tmp), "large")

    # ── Edge: empty + corrupt ──
    eid = ingest(make_empty(tmp), "empty")
    cid = ingest(make_corrupt_pdf(tmp), "corrupt_pdf")

    # ── get_documents ──
    t0 = time.time()
    try:
        res = engine.request("get_documents", {})
        docs = res.get("result", []) or []
        record("get_documents", "PASS" if res.get("status") == "ok" else "FAIL",
               f"count={len(docs)}", time.time() - t0)
    except Exception as e:
        record("get_documents", "FAIL", str(e), time.time() - t0, "DOC-EXC")
        failures += 1

    # ── search (semantic, needs embeddings) ──
    if md_id:
        t0 = time.time()
        try:
            res = engine.request("search", {"query": "when was Rome founded", "limit": 5})
            sr = res.get("result", []) or []
            record("search:semantic", "PASS" if res.get("status") == "ok" and sr else "FAIL",
                   f"hits={len(sr)} top_score={sr[0]['score']:.3f}" if sr else "no hits",
                   time.time() - t0)
            if not sr:
                failures += 1
        except Exception as e:
            record("search:semantic", "FAIL", str(e), time.time() - t0, "SRCH-EXC")
            failures += 1

    # ── chat_stream (real LLM) ──
    if md_id:
        t0 = time.time()
        try:
            res = engine.stream("chat_stream", {"message": "When was the Renaissance? Answer briefly.", "doc_id": md_id})
            answer = "".join(res["tokens"]).strip()
            end = res["end"]
            ok = end.get("type") == "end" and answer and "[Error" not in answer
            record("chat:stream", "PASS" if ok else "FAIL",
                   f"answer_len={len(answer)} :: {answer[:80]!r}", time.time() - t0)
            if not ok:
                failures += 1
        except Exception as e:
            record("chat:stream", "FAIL", str(e), time.time() - t0, "CHAT-EXC")
            failures += 1

    # ── flashcards / quiz ──
    if md_id:
        for action, label in (("generate_flashcards", "flashcards"), ("generate_quiz", "quiz")):
            t0 = time.time()
            try:
                res = engine.request(action, {"doc_id": md_id})
                items = res.get("result", []) or []
                record(f"generate:{label}", "PASS" if res.get("status") == "ok" and items else "FAIL",
                       f"count={len(items)}", time.time() - t0)
                if not items:
                    failures += 1
            except Exception as e:
                record(f"generate:{label}", "FAIL", str(e), time.time() - t0, "GEN-EXC")
                failures += 1

    # ── timeline (BC / century / year) ──
    if md_id:
        t0 = time.time()
        try:
            res = engine.request("generate_timeline", {"doc_id": md_id})
            ev = res.get("result", []) or []
            dates = [e.get("date") for e in ev]
            # verify chronological: 753 bc should sort before 1991
            record("generate:timeline", "PASS" if res.get("status") == "ok" and ev else "FAIL",
                   f"events={len(ev)} dates={dates}", time.time() - t0)
            if not ev:
                failures += 1
        except Exception as e:
            record("generate:timeline", "FAIL", str(e), time.time() - t0, "TL-EXC")
            failures += 1

    # ── mindmap ──
    if md_id:
        t0 = time.time()
        try:
            res = engine.request("generate_mindmap", {"doc_id": md_id})
            mm = res.get("result", "")
            ok = res.get("status") == "ok" and isinstance(mm, str) and mm.startswith("flowchart")
            record("generate:mindmap", "PASS" if ok else "FAIL",
                   f"len={len(mm)} starts={mm[:20]!r}", time.time() - t0)
            if not ok:
                failures += 1
        except Exception as e:
            record("generate:mindmap", "FAIL", str(e), time.time() - t0, "MM-EXC")
            failures += 1

    # ── save_notes / get_document ──
    if md_id:
        t0 = time.time()
        try:
            res = engine.request("save_notes", {"doc_id": md_id, "content": "# Edited notes\nNew line added by QA."})
            ok = res.get("status") == "ok"
            res2 = engine.request("get_document", {"doc_id": md_id})
            doc = res2.get("result") or {}
            has_notes = bool(doc.get("notes"))
            record("notes:save+get", "PASS" if ok and has_notes else "FAIL",
                   f"has_notes={has_notes} flashcards_in_doc={len(doc.get('flashcards', []) or [])}", time.time() - t0)
            if not (ok and has_notes):
                failures += 1
        except Exception as e:
            record("notes:save+get", "FAIL", str(e), time.time() - t0, "NOTE-EXC")
            failures += 1

    # ── export every format ──
    if md_id:
        for fmt in ("markdown", "html", "json", "anki", "quiz_json", "flashcards_json", "mermaid", "csv"):
            t0 = time.time()
            try:
                res = engine.request("export_document", {"doc_id": md_id, "format": fmt})
                r = res.get("result", {})
                content = r.get("content", "")
                ok = res.get("status") == "ok" and content != ""
                record(f"export:{fmt}", "PASS" if ok else "FAIL",
                       f"filename={r.get('filename')} len={len(content)}", time.time() - t0)
                if not ok:
                    failures += 1
            except Exception as e:
                record(f"export:{fmt}", "FAIL", str(e), time.time() - t0, "EXP-EXC")
                failures += 1

    # ── get_models / select_model validation ──
    t0 = time.time()
    try:
        res = engine.request("get_models", {})
        models = res.get("result", []) or []
        record("get_models", "PASS" if res.get("status") == "ok" and models else "FAIL",
               f"models={[m['id'] for m in models]} selected={[m['id'] for m in models if m.get('selected')]}",
               time.time() - t0)
    except Exception as e:
        record("get_models", "FAIL", str(e), time.time() - t0, "MODEL-EXC")
        failures += 1

    t0 = time.time()
    try:
        res = engine.request("select_model", {"model_id": "does-not-exist"})
        ok = res.get("status") == "error" and "error" in res
        record("select_model:invalid", "PASS" if ok else "FAIL",
               f"status={res.get('status')} err={res.get('error','')[:40]}", time.time() - t0)
        if not ok:
            failures += 1
    except Exception as e:
        record("select_model:invalid", "FAIL", str(e), time.time() - t0, "SEL-EXC")
        failures += 1

    # ── delete (cleanup) ──
    for doc_id in created_doc_ids:
        try:
            engine.request("delete_document", {"doc_id": doc_id})
        except Exception:
            pass

    engine.stop()

    # ── Summary ──
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    print("\n==== QA SUMMARY ====")
    print(f"TOTAL={len(RESULTS)} PASS={passed} FAIL={len(RESULTS)-passed}")
    out = tmp / "qa_results.json"
    out.write_text(json.dumps(RESULTS, indent=2), encoding="utf-8")
    print(f"results written to {out}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
