import os
import sys
import tempfile
import shutil
import json
from pathlib import Path

# Setup temporary directory and database
temp_dir = tempfile.mkdtemp()
temp_db_path = Path(temp_dir) / "test_khoji.db"

# 1. Monkeypatch Database init before importing anything else
from khoji_engine.database.db import Database
original_init = Database.__init__
def mock_init(self, db_path=None):
    original_init(self, db_path=temp_db_path)
Database.__init__ = mock_init

# 2. Monkeypatch Embedder load and embed methods
from khoji_engine.ai.embeddings import Embedder
def mock_load(self):
    self.state.loaded = True
    self.state.model_name = "all-MiniLM-L6-v2"
    return True
def mock_embed(self, texts):
    return [[0.1] * 384 for _ in texts]
def mock_embed_one(self, text):
    return [0.1] * 384
Embedder.load = mock_load
Embedder.embed = mock_embed
Embedder.embed_one = mock_embed_one

# 3. Monkeypatch VectorStore methods to avoid FAISS dependencies/network
from khoji_engine.ai.vector_search import VectorStore
def mock_vector_init(self, store_path=None):
    self.store_path = Path(temp_dir) / "vectors"
    self.store_path.mkdir(parents=True, exist_ok=True)
    self._chunk_ids = []
    self._metadata = []
def mock_vector_search(self, query, limit=10):
    return [
        {
            "chunk_id": "test_chunk_1",
            "score": 0.95,
            "metadata": {"doc_id": "test_doc_1", "text": "This is a mock chunk text."}
        }
    ]
def mock_add_vectors(self, chunk_ids, embeddings, metadata=None):
    self._chunk_ids.extend(chunk_ids)
    if metadata:
        self._metadata.extend(metadata)
def mock_remove_document(self, doc_id):
    return 1
def mock_save(self):
    pass
VectorStore.__init__ = mock_vector_init
VectorStore.search = mock_vector_search
VectorStore.add_vectors = mock_add_vectors
VectorStore.remove_document = mock_remove_document
VectorStore._save = mock_save

# 4. Monkeypatch LocalLLM to avoid downloads
from khoji_engine.ai.llm import LocalLLM
def mock_llm_init(self, config=None):
    from khoji_engine.ai.llm import LLMState, LLMConfig
    self.config = config or LLMConfig()
    self.state = LLMState(loaded=True, model_name=self.config.model_name)
    self._llm = "mock_llama_cpp"
def mock_llm_ensure_model(self, progress_callback=None):
    return True
def mock_llm_load(self):
    return True
def mock_llm_generate(self, prompt, system_prompt=None):
    return "This is a mock LLM response."
def mock_llm_is_loaded(self):
    return True
LocalLLM.__init__ = mock_llm_init
LocalLLM.ensure_model = mock_llm_ensure_model
LocalLLM.load = mock_llm_load
LocalLLM.generate = mock_llm_generate
LocalLLM.is_loaded = mock_llm_is_loaded

# 5. Monkeypatch process_document_sync
import khoji_engine.pipeline.processor as processor
def mock_process_document_sync(file_path, db=None, **kwargs):
    from khoji_engine.database.db import Database
    if db is None:
        db = Database()
    doc = db.document_exists(file_path)
    if not doc:
        doc = db.create_document(filename="test.pdf", file_path=file_path, file_size=100)
    db.update_document(doc["id"], status="ready") # Use ready to test the ready->100 fix!
    db.upsert_notes(doc["id"], "This is mock extracted text. It is a definition of something. Something is interesting.")
    db.add_flashcards(doc["id"], [{"front": "Front of card", "back": "Back of card"}])
    db.add_quiz_questions(doc["id"], [{"question": "Mock question?", "options": ["A", "B", "C"], "correct_answer_index": 0}])
    
    from khoji_engine.pipeline.processor import ProcessingResult
    return ProcessingResult(
        doc_id=doc["id"],
        success=True,
        message="Processed successfully (mocked)",
        page_count=5,
        chunk_count=10,
        flashcard_count=1,
        quiz_count=1
    )
processor.process_document_sync = mock_process_document_sync

# Create a mock file on disk for processing
dummy_file = Path(temp_dir) / "test.pdf"
dummy_file.write_text("dummy PDF content")

# Import main handler
from khoji_engine.main import handle_message

def run_tests():
    print("Starting verification of IPC actions...")
    
    # 1. ping
    res = handle_message({"action": "ping", "payload": {}})
    assert res.get("status") == "ok", f"ping failed: {res}"
    print("✓ ping passed")

    # 2. process_document
    res = handle_message({"action": "process_document", "payload": {"file_path": str(dummy_file)}})
    assert res.get("status") == "ok", f"process_document failed: {res}"
    doc_id = res["result"]["doc_id"]
    print(f"✓ process_document passed (doc_id: {doc_id})")

    # 3. search
    res = handle_message({"action": "search", "payload": {"query": "test query"}})
    assert res.get("status") == "ok", f"search failed: {res}"
    print("✓ search passed")

    # 4. generate_flashcards
    res = handle_message({"action": "generate_flashcards", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"generate_flashcards failed: {res}"
    print("✓ generate_flashcards passed")

    # 5. generate_quiz
    res = handle_message({"action": "generate_quiz", "payload": {"doc_id": doc_id, "count": 2}})
    assert res.get("status") == "ok", f"generate_quiz failed: {res}"
    print("✓ generate_quiz passed")

    # 6. get_documents
    res = handle_message({"action": "get_documents", "payload": {}})
    assert res.get("status") == "ok", f"get_documents failed: {res}"
    assert len(res["result"]) > 0, "No documents returned"
    print("✓ get_documents passed")

    # 7. get_document
    res = handle_message({"action": "get_document", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"get_document failed: {res}"
    print("✓ get_document passed")

    # 8. export_document
    res = handle_message({"action": "export_document", "payload": {"doc_id": doc_id, "format": "markdown"}})
    assert res.get("status") == "ok", f"export_document failed: {res}"
    print("✓ export_document passed")

    # 9. get_models
    res = handle_message({"action": "get_models", "payload": {}})
    assert res.get("status") == "ok", f"get_models failed: {res}"
    print("✓ get_models passed")

    # 10. get_chat_history
    # Let's create a chat session first using direct DB or IPC handler test
    db = Database()
    session = db.create_chat_session("Initial Session", doc_id)
    session_id = session["id"]
    res = handle_message({"action": "get_chat_history", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"get_chat_history failed: {res}"
    print("✓ get_chat_history passed")

    # 11. download_model
    res = handle_message({"action": "download_model", "payload": {"model_id": "qwen2.5-0.5b"}})
    assert res.get("status") == "ok", f"download_model failed: {res}"
    print("✓ download_model passed")

    # 12. check_processing_status
    res = handle_message({"action": "check_processing_status", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"check_processing_status failed: {res}"
    assert res["result"]["status"] == "ready", f"Expected ready, got {res['result']['status']}"
    print("✓ check_processing_status passed")

    # 13. get_processing_progress
    res = handle_message({"action": "get_processing_progress", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"get_processing_progress failed: {res}"
    assert res["result"]["progress"] == 100, f"Expected progress 100 for status ready, got {res['result']['progress']}"
    print("✓ get_processing_progress passed")

    # 14. generate_timeline
    res = handle_message({"action": "generate_timeline", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"generate_timeline failed: {res}"
    print("✓ generate_timeline passed")

    # 15. generate_mindmap
    res = handle_message({"action": "generate_mindmap", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"generate_mindmap failed: {res}"
    print("✓ generate_mindmap passed")

    # 16. save_notes (new)
    new_content = "This is newly saved notes content."
    res = handle_message({"action": "save_notes", "payload": {"doc_id": doc_id, "content": new_content}})
    assert res.get("status") == "ok", f"save_notes IPC failed: {res}"
    # Verify DB update
    notes = db.get_notes(doc_id)
    assert notes["content"] == new_content, f"Notes content not updated in DB: {notes}"
    print("✓ save_notes passed")

    # 17. save_chat_session (new)
    chat_messages = [
        {"role": "user", "content": "Hello AI", "sources_json": json.dumps(["src1"])},
        {"role": "assistant", "content": "Hello User"}
    ]
    res = handle_message({
        "action": "save_chat_session",
        "payload": {
            "session_id": session_id,
            "doc_id": doc_id,
            "title": "Updated Session Title",
            "messages": chat_messages
        }
    })
    assert res.get("status") == "ok", f"save_chat_session IPC failed: {res}"
    # Verify DB update
    saved_session = db.get_chat_session(session_id)
    assert saved_session["title"] == "Updated Session Title", f"Session title not updated in DB: {saved_session}"
    saved_messages = db.get_chat_messages(session_id)
    assert len(saved_messages) == 2, f"Expected 2 messages, got {len(saved_messages)}"
    assert saved_messages[0]["content"] == "Hello AI", f"Message content mismatch: {saved_messages[0]}"
    print("✓ save_chat_session passed")

    # 18. delete_document
    res = handle_message({"action": "delete_document", "payload": {"doc_id": doc_id}})
    assert res.get("status") == "ok", f"delete_document failed: {res}"
    assert res["result"]["deleted"] is True, f"Expected deleted to be True, got {res['result']}"
    # Confirm document no longer exists
    assert db.get_document(doc_id) is None, "Document still exists in DB after deletion"
    print("✓ delete_document passed")

    print("\nAll IPC actions verified successfully!")

if __name__ == "__main__":
    try:
        run_tests()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
