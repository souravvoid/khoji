# 08 — Improvement Opportunities

> Every improvement opportunity with current state, problem, impact, recommendation, complexity, and benefit.

---

## Critical Fixes (Must-Fix Before Hackathon Demo)

---

### IMP-01: Wire Semantic Search in SearchModal

**Current implementation:**  
`SearchModal.tsx` filters `documents[]` by `title.includes(query)` client-side. It never calls `ipc.searchDocuments()`.

**Problem:**  
The entire FAISS infrastructure — embedding model, vector store, 63 indexed chunks — is completely unused from the user's perspective. A user searching "photosynthesis" in a document titled "Biology Notes" will find it, but searching for content *within* documents fails entirely.

**Impact:** High — Semantic search is a core differentiating feature. Judges will notice.

**Recommended fix:**
```typescript
// In SearchModal.tsx, replace filteredDocs with:
const [results, setResults] = useState<SearchResult[]>([])

useEffect(() => {
  if (!query || query.length < 3) { setResults([]); return }
  const timer = setTimeout(async () => {
    const hits = await searchDocuments(query, 10)
    setResults(hits || [])
  }, 300) // 300ms debounce
  return () => clearTimeout(timer)
}, [query])
```

**Estimated complexity:** 2 hours  
**Expected benefit:** Transforms search from "search by file name" to "search inside all documents"

---

### IMP-02: Fix Flashcard 3D Flip Animation

**Current implementation:**  
`FlashcardReview.tsx` uses `rotateY-180` as a Tailwind class and CSS `preserve-3d` + `backface-hidden`. The class `rotateY-180` is not a built-in Tailwind utility — it likely doesn't exist.

**Problem:**  
Flashcard flip animation doesn't work. Clicking a card does nothing visible. This is a core UX moment in the demo.

**Recommended fix:**  
Use inline styles for the 3D transform:
```tsx
<div
  style={{
    transformStyle: 'preserve-3d',
    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
    transition: 'transform 0.5s ease-in-out',
  }}
>
```
And for backface:
```tsx
<div style={{ backfaceVisibility: 'hidden' }}>  {/* Front */}
<div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>  {/* Back */}
```

**Estimated complexity:** 30 minutes  
**Expected benefit:** The flashcard review becomes visually impressive and actually works

---

### IMP-03: Fix Notes Edit → Save to Database

**Current implementation:**  
`NotesTab.tsx` has `onEdit` prop that is called on `onBlur`. But in `DocumentWorkspace.tsx`, the `onEdit` handler only updates local state — it does NOT call `ipc.saveNotes()` or similar.

**Problem:**  
Users can edit notes but changes disappear on navigation. Critical data loss.

**Recommended fix:**
1. Add `save_notes` IPC action in Python backend
2. In `DocumentWorkspace.tsx` onEdit handler: `await ipc.saveNotes(docId, content)`
3. Update documentStore

**Estimated complexity:** 1 hour  
**Expected benefit:** Notes become a real editing experience

---

### IMP-04: Fix Script Paths (frontend/ → frontend1/)

**Current implementation:**  
`scripts/run-dev.sh` and `scripts/build-linux.sh` both reference `frontend/` which is the empty skeleton directory.

**Problem:**  
`./scripts/run-dev.sh` will fail with "No package.json found". Build scripts won't work.

**Recommended fix:**
```bash
# In both scripts, replace:
cd frontend
# With:
cd frontend1
```

**Estimated complexity:** 5 minutes  
**Expected benefit:** Dev and build scripts work correctly

---

### IMP-05: Add Loading State During LLM Inference

**Current implementation:**  
When user sends a chat message, there is no visual feedback during the 10-60 second LLM inference. `isStreaming` state exists in chatStore but it's unclear if a spinner is shown.

**Problem:**  
Users will think the app is frozen during LLM inference.

**Recommended fix:**
```tsx
// In ChatPanel, show streaming indicator:
{isStreaming && (
  <div className="flex items-center gap-2 px-4 py-2 text-text-tertiary text-sm">
    <Loader2 size={14} className="animate-spin" />
    <span>Khoji is thinking...</span>
  </div>
)}
```

**Estimated complexity:** 30 minutes  
**Expected benefit:** Users understand the app is working, not frozen

---

### IMP-06: Fix Document Deletion (Cascade)

**Current implementation:**  
`documentStore.removeDocument(id)` only removes from the in-memory store. `db.delete_document(id)` exists but is not called. FAISS vectors for the document are never removed.

**Problem:**  
Deleting a document doesn't actually delete it from SQLite or FAISS. Re-launching the app shows it again.

**Recommended fix:**
```typescript
// In documentStore.ts:
removeDocument: async (id) => {
  await ipc.deleteDocument(id)  // Call backend
  set(s => ({ documents: s.documents.filter(d => d.id !== id) }))
}
```

**Estimated complexity:** 1 hour (includes FAISS index rebuild)  
**Expected benefit:** Delete actually works

---

## High-Value Improvements (2-4 hours each)

---

### IMP-07: Real-Time Processing Progress

**Current implementation:**  
`process_document` IPC is synchronous. The frontend shows a processing modal with a static progress bar that jumps from 0% to 100%.

**Problem:**  
For large documents (5+ minutes), users see a frozen progress bar. No stage updates.

**Recommended fix (simple approach):**  
Poll document status every 2 seconds during processing:
```typescript
// While job is in queue, poll:
const poll = setInterval(async () => {
  const doc = await ipc.getDocument(docId)
  updateProcessingJob(filePath, { status: doc.status })
}, 2000)
```

**Better fix:** Emit Tauri events from Rust during pipeline stages.

**Estimated complexity:** 3-4 hours (Tauri events approach)  
**Expected benefit:** Users see real progress; pipeline stages light up

---

### IMP-08: Apply Font Size + Reading Mode to DOM

**Current implementation:**  
`settingsStore.fontSize` and `settingsStore.readingMode` are stored but never applied to the DOM.

**Problem:**  
Settings exist but have no visible effect. Users will notice settings don't work.

**Recommended fix:**
```tsx
// In App.tsx or index.css:
useEffect(() => {
  const sizeMap = { sm: '13px', md: '15px', lg: '17px', xl: '19px' }
  document.documentElement.style.setProperty('--reading-font-size', sizeMap[fontSize])
  if (readingMode) {
    document.body.classList.add('reading-mode')
  } else {
    document.body.classList.remove('reading-mode')
  }
}, [fontSize, readingMode])
```

**Estimated complexity:** 1 hour  
**Expected benefit:** Settings actually work; professional feel

---

### IMP-09: Dynamic Model Name in StatusBar

**Current implementation:**  
`StatusBar.tsx` hardcodes `"Model: Qwen 2.5 (0.5B)"`.

**Problem:**  
If user has a different model selected, StatusBar is wrong.

**Recommended fix:**
```tsx
// In StatusBar.tsx:
const models = useSettingsStore(s => s.models)
const activeModel = models.find(m => m.type === 'llm' && m.selected)
// Show: activeModel?.name || "No model loaded"
```

**Estimated complexity:** 30 minutes  
**Expected benefit:** Status bar reflects actual state

---

### IMP-10: Fix Sidebar Navigation (Learn Section)

**Current implementation:**  
Sidebar Learn section items (Flashcards, Quiz, Mind Maps, Timeline) all navigate to `'library'` view.

**Problem:**  
Clicking "Flashcards" in the sidebar should open the flashcards tab of the active document. Currently it does nothing useful.

**Recommended fix:**  
If an active document is open, navigate to the document view with the relevant tab selected:
```typescript
// Add to uiStore: activeTab: string
// In Sidebar, clicking "Flashcards":
if (activeDocumentId) {
  setCurrentView('document')
  setActiveTab('flashcards')
} else {
  // Show tooltip: "Open a document first"
}
```

**Estimated complexity:** 2 hours  
**Expected benefit:** Navigation makes sense; sidebar items actually work

---

### IMP-11: Load Chat History from Database

**Current implementation:**  
`chat_sessions` table exists in SQLite. But on app startup, chat sessions are not loaded. All chat history is lost on restart.

**Problem:**  
Khoji is a knowledge workspace — persistent chat is expected.

**Recommended fix:**
1. Add `get_chat_sessions(doc_id)` IPC handler in Python
2. Load sessions when document is opened
3. `chatStore.setSessions(sessions)` + set active session

**Estimated complexity:** 3 hours  
**Expected benefit:** Chat feels like a knowledge companion, not a stateless Q&A

---

### IMP-12: Pre-warm Embedding Model at Startup

**Current implementation:**  
The embedding model loads on first `process_document` or `search_documents` call. This takes ~60 seconds.

**Problem:**  
First document processing takes 1+ minutes just to load the model. No feedback.

**Recommended fix:**  
Load the embedding model as a background task when Python subprocess starts:
```python
# In main.py, after starting the IPC loop:
import threading
def warmup():
    from khoji_engine.ai.embeddings import get_embedder
    get_embedder().load()  # Loads and caches
threading.Thread(target=warmup, daemon=True).start()
```

**Estimated complexity:** 1 hour  
**Expected benefit:** First document processes in ~5s instead of ~65s

---

## Medium Priority (Polish)

---

### IMP-13: Export Include/Exclude Toggles Backend Wiring

**Current implementation:**  
`ExportDialog` has toggles for Notes/Flashcards/Quiz. These are not sent to `ipc.exportDocument()`.

**Recommended fix:**  
Pass options to the exporter and conditionally include content:
```python
# In exporter.py:
def export_markdown(doc_id, db, include_notes=True, include_flashcards=True, include_quiz=True):
```

**Estimated complexity:** 2 hours

---

### IMP-14: Retry Button in ProcessingModal

**Current implementation:**  
Retry button renders but `onClick={() => {}}` — completely empty.

**Recommended fix:**  
Re-queue the failed job:
```tsx
onClick={() => {
  updateProcessingJob(activeJob.filePath, { status: 'pending', progress: 0, error: undefined })
  processDocument(activeJob.filePath)
}}
```

**Estimated complexity:** 1 hour

---

### IMP-15: DocumentCard Export Action

**Current implementation:**  
`DocumentCard.onExport` is called with `() => {}` in LibraryView.

**Recommended fix:**  
Pass a real handler that sets the active document and opens ExportDialog.

**Estimated complexity:** 30 minutes

---

## Architecture Improvements (Future)

---

### IMP-16: True LLM Response Streaming

**Current limitation:**  
LLM returns full response at once. Users wait 5-30 seconds with no visible output.

**Recommended approach:**  
Use Tauri events to emit tokens as they're generated:
```python
# In Python: emit via stdout as NDJSON events:
{"type": "token", "content": "Hello"}
{"type": "done", "content": ""}
```
```rust
// In Rust: relay events to frontend:
window.emit("chat-token", token)?;
```

**Estimated complexity:** 1-2 days  
**Expected benefit:** Chat feels live and responsive

---

### IMP-17: Non-Blocking IPC (Async Python)

**Current limitation:**  
Single-threaded Python IPC blocks all commands during processing.

**Recommended approach:**  
Wrap the IPC loop with asyncio + thread pool for concurrent requests.

**Estimated complexity:** 2-3 days  
**Expected benefit:** Chat and search work while document is being processed

---

### IMP-18: FTS5 Full-Text Search (SQLite)

**Current limitation:**  
No FTS5 search index. Chunk text can only be searched via FAISS (semantic).

**Recommended addition:**  
Add FTS5 virtual table for exact keyword search:
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(content, content=chunks, content_rowid=rowid);
```

**Estimated complexity:** 4 hours  
**Expected benefit:** Hybrid search (semantic + keyword) gives best recall

---

## MVP Priority Matrix

| Improvement | Impact | Effort | Priority |
|---|---|---|---|
| IMP-01 Semantic search wiring | 🔴 Critical | Low (2h) | **DO NOW** |
| IMP-02 Flashcard flip fix | 🔴 Critical | Low (0.5h) | **DO NOW** |
| IMP-03 Notes save to DB | 🔴 Critical | Low (1h) | **DO NOW** |
| IMP-04 Fix script paths | 🔴 Critical | Trivial | **DO NOW** |
| IMP-05 LLM loading indicator | 🟠 High | Low (0.5h) | **DO NOW** |
| IMP-06 Fix delete cascade | 🟠 High | Medium (1h) | Do soon |
| IMP-12 Pre-warm embeddings | 🟠 High | Low (1h) | Do soon |
| IMP-07 Real-time progress | 🟡 Medium | High (4h) | Nice-to-have |
| IMP-08 Font size apply | 🟡 Medium | Low (1h) | Do soon |
| IMP-10 Sidebar navigation | 🟡 Medium | Medium (2h) | Do soon |
| IMP-11 Chat history load | 🟡 Medium | Medium (3h) | Do soon |
| IMP-09 Dynamic model name | 🟢 Low | Trivial | Easy win |
| IMP-13 Export toggles | 🟢 Low | Medium (2h) | Polish |
| IMP-14 Retry button | 🟢 Low | Low (1h) | Polish |
| IMP-15 Card export action | 🟢 Low | Trivial | Easy win |
| IMP-16 Streaming tokens | 🟠 High | Very High (2d) | Post-hackathon |
| IMP-17 Async IPC | 🟡 Medium | Very High (3d) | Post-hackathon |
| IMP-18 FTS5 search | 🟡 Medium | Medium (4h) | Post-hackathon |
