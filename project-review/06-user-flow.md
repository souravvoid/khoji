# 06 — User Flow Analysis

> The complete end-to-end workflow from app launch to export, step by step.

---

## Flow 1: First Launch (Cold Start)

```
1. User launches Khoji (double-click AppImage or `cargo tauri dev`)
   │
2. Tauri shell starts (Rust binary loads in ~0.5s)
   │
3. React frontend renders (Vite bundle, ~200ms)
   │
4. Tauri spawns Python subprocess (python3 -m khoji_engine.main)
   │
   └── Python: imports stdlib + logging (~0.3s)
   └── Python: sends nothing (waits for stdin)
   │
5. App.tsx useEffect runs:
   a. Calls ipc.getDocuments() → handle_message('get_documents')
      └── Python: imports db.py, opens ~/.khoji/khoji.db
      └── Python: returns document list
   b. Populates documentStore
   │
6. Theme is read from localStorage → applied as data-theme on <html>
   │
7. User sees: LibraryView (if no documents) or Library with cards

⏱ Total cold start: ~2-3 seconds (Python DB init is fast)
⚠ Note: Embedding model is NOT loaded at startup (lazy)
⚠ Note: LLM is NOT loaded at startup (lazy)
```

---

## Flow 2: Importing a Document

```
User clicks "Upload Document" (TopBar) or the EmptyState CTA
   │
open() from @tauri-apps/plugin-dialog
   └── Native OS file picker opens
   └── User selects file(s)
   │
App.tsx handleUpload():
   1. For each selected file:
      a. Add to processingQueue in documentStore:
         { filePath, filename, status: 'pending', progress: 0, stage: 'ocr' }
      b. ProcessingModal appears (queue.length > 0)
   │
   2. Call ipc.processDocument(file_path)
      └── Python: process_document_sync(file_path)
      └── Stages run (extract → markdown → chunk → embed → flashcard → quiz)
      └── Returns: { doc_id, status, page_count, chunk_count }
   │
   3. On success:
      a. Add document to documentStore.documents
      b. Remove from processingQueue
      c. ProcessingModal disappears
      d. Navigate to document workspace: setActiveDocumentId + setCurrentView('document')
   │
   4. On error:
      a. Update job: { status: 'error', error: message }
      b. ProcessingModal shows error state
      c. Retry button visible (but not functional)

⏱ Processing time (44-page PDF):
   - Text extraction: ~2s
   - Embedding generation: ~60s on FIRST call (model load), ~5s after
   - Total pipeline: 1-5 minutes depending on document size
   
⚠ UX Gap: Progress bar doesn't update during processing (0% → 100% jump)
⚠ UX Gap: Retry button renders but has no handler
```

---

## Flow 3: Reading Notes

```
User is in DocumentWorkspace (Notes tab is default)
   │
useEffect triggers when activeDocument changes:
   1. ipc.getNotes(doc_id)
      └── Python: db.get_notes(doc_id) → returns {content: "# Title\n..."}
   │
2. NotesTab renders:
   - Markdown preview by default (react-markdown + remark-gfm)
   - GFM tables, task lists, code blocks rendered
   │
3. User clicks Edit button (pencil icon):
   - Switches to textarea with monospace font
   - Content editable
   │
4. User edits and clicks elsewhere (onBlur):
   - Calls onEdit(newContent)
   - Currently: only updates local state (not saved to DB!)
   
⚠ Bug: Edits to notes are NOT persisted to the database
⚠ Missing: No "Save" IPC call in NotesTab
```

---

## Flow 4: Flashcard Review

```
User navigates to Flashcards tab in DocumentWorkspace
   │
FlashcardsTab useEffect:
   1. ipc.getFlashcards(doc_id)
   2. Renders cards as a grid

User clicks "Start Review"
   │
reviewStore.startReview(cards):
   - Initializes queue, stats, currentIndex=0
   │
FlashcardReview renders (full-screen, z-modal):
   │
   ┌── Front face shown: { role: "Question", text: card.front }
   │
User presses Space or clicks card:
   └── reviewStore.flip() → flipped=true
   └── Back face shows: { role: "Answer", text: card.back }
   │
User presses 1/2/3/4 (or clicks rating buttons):
   └── reviewStore.rate('again'|'hard'|'good'|'easy')
   └── stats updated, currentIndex++, flipped=false
   │
Repeat until currentIndex >= queue.length
   │
Completion screen:
   - 🎉 emoji + "Review Complete!"
   - Stats breakdown (again/hard/good/easy counts)
   - "Return to Workspace" button → endReview()

⚠ Missing: No SM-2 scheduling (ratings don't affect future review order)
⚠ Missing: Review stats not persisted to DB
⚠ Bug: CSS 3D flip (rotateY-180) may not render correctly
```

---

## Flow 5: Taking a Quiz

```
User navigates to Quiz tab
   │
QuizTab useEffect:
   1. ipc.getQuizQuestions(doc_id)
   2. Renders questions one at a time
   │
Each question:
   - Question text displayed
   - 4 option buttons (A/B/C/D or labeled by content)
   │
User selects an option:
   - Highlight selected
   - Show if correct (green) or incorrect (red)
   - Display explanation text
   - Progress to next question
   │
Completion:
   - Score displayed: "X / Y correct"
   - Option to restart

✅ This flow appears fully functional
```

---

## Flow 6: AI Chat

```
User clicks Chat button in DocumentWorkspace TopBar
   └── uiStore.toggleChat() → chatOpen=true
   └── ChatPanel slides in from the right
   │
If no session exists:
   - ChatPanel shows welcome state
   - User types a message
   │
On first message:
   1. Create new session in chatStore
   2. Show user message immediately (optimistic)
   3. Set isStreaming=true
   │
ipc.chat({ message, doc_id, session_id }):
   └── Python:
       a. embed_one(message) → query vector
       b. FAISS search(vector, k=5) → relevant chunks
       c. Build prompt with document context
       d. Llama.cpp inference (model loads on first call: 10-30s)
       e. Return full response string
   │
4. Add assistant message to chatStore
5. isStreaming=false
   │
Chat renders with citations/source chunks (if returned)

⏱ First chat message: 10-60s (model load + inference)
⏱ Subsequent: 5-30s (inference only, model cached)

⚠ UX Gap: No visual feedback during 10-60s wait
⚠ Missing: Chat history not loaded from DB on startup
⚠ Missing: True token streaming (returns full response at once)
```

---

## Flow 7: Mind Map Viewing

```
User navigates to Mind Map tab
   │
MindMapTab useEffect:
   1. ipc.generateMindMap(doc_id)
      └── Python: gets doc chunks → generate_mind_map(full_text)
      └── Returns: { topic: "...", nodes: [{label, children}] }
   │
2. SVG canvas renders the tree:
   - Root node (topic) at center-left
   - Subtopics branch outward
   - Children of subtopics
   - Connecting lines between nodes
   │
3. User can likely pan/zoom (TBD — depends on implementation)

⚠ Note: Mind map from document text may be sparse for content-dense PDFs
```

---

## Flow 8: Timeline Viewing

```
User navigates to Timeline tab
   │
TimelineTab useEffect:
   1. ipc.generateTimeline(doc_id)
      └── Python: gets doc chunks → generate_timeline(full_text)
      └── Returns: [{ date, title, description }]
   │
2. Renders vertical timeline:
   - Connecting line on left
   - Date badge for each event
   - Title and description
   - Sorted chronologically
   │
   └── If no dates found: EmptyState shown

✅ Works for historical/technical content with year references
```

---

## Flow 9: Semantic Search

```
User presses ⌘K (or clicks search bar)
   └── SearchModal opens, input focused
   │
User types a query (e.g., "machine learning algorithms")
   │
CURRENT (broken):
   documents.filter(d => d.title.includes(query))
   → shows only documents whose title contains the string
   
INTENDED:
   ipc.searchDocuments(query, limit=10)
   → FAISS semantic search across all chunks
   → Returns relevant passages with scores
   → Shows document title + matched excerpt + page number

User clicks a result:
   → setActiveDocumentId + setCurrentView('document') + close modal

⚠ Bug: Semantic search backend exists but is NOT wired to SearchModal
```

---

## Flow 10: Exporting a Document

```
User clicks Export button in DocumentWorkspace
   └── ExportDialog opens (modal)
   │
User selects format:
   - Markdown (recommended)
   - Anki (TSV flashcards)
   - JSON (full data)
   - HTML (rendered web page)
   - Mermaid (diagram code)
   │
User clicks Export button:
   1. ipc.exportDocument(doc_id, format)
      └── Python: generate content in requested format
      └── Returns: { filename, content }
   │
2. Download triggered via URL.createObjectURL:
   - Blob created from content string
   - <a> tag programmatically clicked
   - File downloads to OS Downloads folder
   │
3. Dialog closes

✅ Export works for all 5 formats
⚠ Missing: include/exclude toggles not passed to backend
⚠ Note: DocumentCard "Export" dropdown item does nothing
```

---

## Flow 11: Settings

```
User presses ⌘, (or clicks Settings in sidebar)
   └── SettingsDrawer opens from right
   │
General tab:
   - Theme toggle (light/dark/system) → works, persisted to localStorage
   - Font size (sm/md/lg/xl) → stored but NOT applied
   - Reading mode toggle → stored but NOT applied
   │
Models tab:
   - Calls ipc.getModels() → shows OCR/embedding/LLM models
   - Download button → calls ipc.downloadModel() → stub (no real download)
   │
Appearance tab:
   - Duplicate of theme toggle
   │
Shortcuts tab:
   - Reference table only (no editing)
   │
Accessibility tab:
   - High contrast toggle → non-functional
   - Reduced motion toggle → non-functional

⚠ Multiple settings exist in UI but are not applied to the application
```

---

## Critical User Experience Gaps

| Gap | Affected Flow | Priority |
|---|---|---|
| No progress during processing | Import (Flow 2) | HIGH |
| No feedback during LLM load/inference | Chat (Flow 6) | HIGH |
| Semantic search not wired | Search (Flow 9) | HIGH |
| Notes edits not saved | Reading (Flow 3) | HIGH |
| 3D flip may not render | Flashcard review (Flow 4) | MEDIUM |
| Chat history lost on restart | Chat (Flow 6) | MEDIUM |
| Export card action broken | Export (Flow 10) | MEDIUM |
| Settings not applied | Settings (Flow 11) | MEDIUM |
| Retry button non-functional | Import error | LOW |
| Model download is a stub | Settings models | LOW |
