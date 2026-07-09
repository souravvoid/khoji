# 03 — Frontend Analysis

> A complete audit of every component, store, hook, and pattern in the React/TypeScript frontend.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.2 |
| Build tool | Vite | 8.0 |
| Language | TypeScript | 5.8 (strict) |
| Styling | TailwindCSS v4 + CSS tokens | 4.3 |
| State | Zustand | 5.0 |
| Animations | Framer Motion | 12.42 |
| Icons | lucide-react | 1.23 |
| Markdown | react-markdown + remark-gfm | 10.1 / 4.0 |
| Desktop API | @tauri-apps/api | 2.11 |
| Linter | oxlint | 0.17 |

---

## Routing & Navigation

There is **no router library** (no react-router, no TanStack Router). Navigation is handled by a single `currentView` string in `uiStore`:

```typescript
currentView: 'library' | 'document'
```

**Implication:** Navigating to a document sets `currentView = 'document'` and `activeDocumentId = id`. There are no browser URLs, no deep-linking, and no back-button. This is appropriate for a desktop app (Tauri) where URL navigation is not expected.

**Open question:** Should the active document be persisted to `localStorage`? Currently, refreshing the app loses the active document context.

---

## State Management (Zustand Stores)

### `uiStore.ts`
**Purpose:** All UI visibility state — what's open, what's visible, what theme.

| State | Type | Purpose |
|---|---|---|
| `currentView` | `'library' \| 'document'` | Main content panel |
| `activeDocumentId` | `string \| null` | Currently open document |
| `sidebarOpen` | `boolean` | Sidebar collapsed/expanded |
| `chatOpen` | `boolean` | Chat panel visibility |
| `searchOpen` | `boolean` | Search modal visibility |
| `settingsOpen` | `boolean` | Settings drawer visibility |
| `theme` | `'light' \| 'dark' \| 'system'` | Color scheme |

**Notes:**
- Theme is persisted to `localStorage` and applied as `data-theme` on `document.documentElement`
- `activeDocument` is a computed selector: `useDocumentStore().documents.find(d => d.id === activeDocumentId)`
- `toggleDarkMode` toggles between light/dark (ignores system)

### `documentStore.ts`
**Purpose:** Document library data + processing queue.

| State | Type | Purpose |
|---|---|---|
| `documents` | `Document[]` | Full library list |
| `processingQueue` | `ProcessingJob[]` | Active + pending pipeline jobs |

**Key actions:**
- `loadDocuments()` → calls `ipc.getDocuments()` → populates store
- `addToProcessingQueue(job)` → pushes to queue
- `updateProcessingJob(filePath, updates)` → updates progress/stage
- `removeProcessingJob(filePath)` → removes when done
- `removeDocument(id)` → removes from `documents[]` (does NOT delete from DB currently)

**Processing job structure:**
```typescript
interface ProcessingJob {
  filePath: string
  filename: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number      // 0-100
  stage: string         // 'ocr' | 'extract' | 'markdown' | etc.
  error?: string
}
```

### `chatStore.ts`
**Purpose:** Chat sessions and messages.

| State | Type | Purpose |
|---|---|---|
| `sessions` | `ChatSession[]` | All chat sessions |
| `activeSessionId` | `string \| null` | Currently active session |
| `isStreaming` | `boolean` | Whether LLM is generating |

**Key actions:**
- `createSession(session)` → adds session + makes it active
- `addMessage(sessionId, message)` → appends message to session
- `updateLastMessage(sessionId, content)` → appends streaming token to last message

**Architecture note:** `updateLastMessage` appends to existing content (streaming). However, the backend currently sends the full response at once, so this is effectively used as a one-shot append. True streaming would call this repeatedly.

### `reviewStore.ts`
**Purpose:** Active flashcard review session (in-memory only, not persisted).

| State | Type | Purpose |
|---|---|---|
| `queue` | `Flashcard[]` | Cards to review |
| `currentIndex` | `number` | Position in queue |
| `flipped` | `boolean` | Card face showing |
| `stats` | `ReviewStats` | again/hard/good/easy counts |

**Note:** The rating system (again/hard/good/easy) mirrors Anki's SM-2 algorithm vocabulary, but no actual spaced repetition scheduling is implemented. Ratings only affect the session statistics display.

### `settingsStore.ts`
**Purpose:** App preferences and model catalogue.

| State | Type | Purpose |
|---|---|---|
| `fontSize` | `'sm'\|'md'\|'lg'\|'xl'` | Reading font size (set but not applied) |
| `readingMode` | `boolean` | Serif font toggle (set but not applied) |
| `models` | `ModelInfo[]` | Model list from backend |

**Bug:** `fontSize` and `readingMode` are stored but never applied to the DOM. The CSS class needs to be set on `body` based on these values.

---

## Components Analysis

### Layout Components

#### `AppShell`
- Master layout container
- Renders: Sidebar + TopBar + main content + StatusBar
- Conditionally renders ProcessingModal when `processingQueue.length > 0`
- Also always renders SearchModal and SettingsDrawer (they control their own visibility)

#### `Sidebar`
- Collapsible sidebar (260px open, 56px collapsed)
- BMW M tricolor stripe at top (3px height)
- Navigation items are hardcoded — all point to `view: 'library'`
- **Bug:** Learn section items (Flashcards, Quiz, Mind Maps, Timeline) all navigate to 'library' instead of opening specific views. They should either open the last document in that tab, or prompt to select a document.

#### `TopBar`
- Search trigger button (opens SearchModal)
- Upload button (triggers file picker)
- Logo shown on mobile (hidden on lg+ since Sidebar has it)

#### `StatusBar`
- Shows document count (live from store)
- Static "CPU" label (no real metrics)
- Static model name "Qwen 2.5 (0.5B)" — should be dynamic from settingsStore

### Library Components

#### `LibraryView`
- Responsive grid: 1→2→3→4 columns
- Empty state with upload CTA
- Renders `DocumentCard` for each document

#### `DocumentCard`
- Shows title, page count, flashcard/quiz count
- Status badge (ready/processing/error/pending)
- Dropdown menu (Export + Delete)
- `onExport` callback is not wired — clicking Export from card does nothing currently
- Hover shows `MoreHorizontal` icon (opacity transition)

#### `UploadZone`
- Drag-and-drop + click-to-open
- Visual feedback on drag-over (scale + border change)
- Accepts: pdf, png, jpg, jpeg, ppt, pptx, doc, docx, epub

### Document Components

#### `DocumentWorkspace`
- Tab system: Notes, Flashcards, Quiz, Mind Map, Timeline
- Right panel: OutlinePanel (collapsible) + ChatPanel
- Export button triggers ExportDialog

#### `NotesTab`
- Preview mode: `react-markdown` with `remark-gfm`
- Edit mode: raw textarea with monospace font
- `onBlur` saves edits — **no explicit Save button** (could lose unsaved edits on navigation)
- Prose classes used for markdown typography

#### `FlashcardsTab`
- Shows cards in grid
- "Start Review" button triggers `FlashcardReview` full-screen mode

#### `FlashcardReview`
- Full-screen takeover (fixed inset-0, z-modal)
- 3D flip animation via CSS `rotateY`
- **Bug:** CSS `rotateY-180` is a custom Tailwind utility that may not be defined. The flip animation may not work.
- Keyboard: Space=flip, 1-4=rate, Escape=exit

#### `QuizTab`
- Interactive MCQ with option selection
- Shows correct answer + explanation on submit
- Score tracking within session

#### `MindMapTab`
- SVG canvas for mind map visualization
- Calls `generateMindMap` IPC → renders as custom SVG tree
- Currently renders as a basic connected node graph

#### `TimelineTab`
- Calls `generateTimeline` IPC on mount
- Vertical timeline with connecting line
- Chronological events with date badges

#### `ExportDialog`
- Format selection: Markdown, Anki, JSON, HTML, Mermaid
- Include/exclude toggles for Notes/Flashcards/Quiz
- **Bug:** The include/exclude toggles are not passed to the backend export call — they're stored in local state but `exportDocumentApi` only receives `doc_id` and `format`

### Search Components

#### `SearchModal`
- Keyboard shortcut: ⌘K
- **Current implementation:** Filters documents by title/filename only (client-side)
- **Missing:** Semantic search via FAISS is NOT wired to this modal
- Navigates to document on selection

### Settings Components

#### `SettingsDrawer`
- 5-section sidebar: General, Models, Appearance, Shortcuts, Accessibility
- Theme toggle (light/dark/system)
- Font size selector (stored but not applied to DOM)
- Reading mode toggle (stored but not applied to DOM)
- Keyboard shortcuts reference table
- Accessibility toggles (high contrast, reduced motion) — non-functional

#### `ModelManager` + `ModelCard`
- Loads model list from backend via `getModels()` IPC
- Shows OCR, Embedding, LLM models grouped by type
- Download button calls `downloadModelApi()` IPC
- Progress tracking via `settingsStore.updateModel()`

### Processing Components

#### `ProcessingModal`
- Shows pipeline stages with status indicators
- Progress bar
- Close (X) button: removes job but doesn't cancel backend processing
- **Bug:** Retry button is rendered but has no `onClick` handler

#### `PipelineVisualization`
- Visual step-by-step pipeline stages
- completed → active → pending coloring

### Review Components

#### `FlashcardReview`
- Full-screen review session
- Statistics: again/hard/good/easy tallied per session
- Completion screen with emoji and stats

#### `RatingButtons`
- Four rating buttons: Again (1), Hard (2), Good (3), Easy (4)
- Color-coded with subtle backgrounds

---

## Animations & Transitions

| Element | Animation |
|---|---|
| Sidebar collapse | CSS `transition-all duration-200ms` |
| Settings drawer | CSS `animate-[slideIn_200ms_ease-out]` |
| Search modal | CSS `animate-[scaleIn_200ms_ease-out]` |
| Processing modal | Framer Motion (imported in ProcessingModal) |
| Flashcard flip | CSS `rotateY` + `preserve-3d` + `backface-visibility` |
| Status indicator | CSS `animate-pulse` |

**Note:** `framer-motion` is installed but appears minimally used. Most animations are pure CSS. The library adds ~40KB to bundle but delivers value only in ProcessingModal.

---

## Identified Bugs & Issues

| ID | Component | Bug | Severity |
|---|---|---|---|
| F-01 | `Sidebar` | Learn/Tools nav items all point to 'library' view | Medium |
| F-02 | `StatusBar` | Model name is hardcoded "Qwen 2.5 (0.5B)" | Low |
| F-03 | `DocumentCard` | Export action in dropdown does nothing | High |
| F-04 | `ExportDialog` | Include/exclude toggles not sent to backend | Medium |
| F-05 | `FlashcardReview` | `rotateY-180` Tailwind utility may be missing | High |
| F-06 | `ProcessingModal` | Retry button has no handler | Medium |
| F-07 | `SearchModal` | No semantic (FAISS) search — title filter only | High |
| F-08 | `SettingsDrawer` | fontSize + readingMode not applied to DOM | Medium |
| F-09 | `NotesTab` | No explicit save button — edits save onBlur only | Low |
| F-10 | `documentStore` | removeDocument doesn't delete from SQLite or FAISS | High |

---

## Potential Improvements

1. **Add semantic search to SearchModal** — wire `search_documents` IPC to replace/augment the title filter
2. **Apply fontSize/readingMode to DOM** — add CSS class to `body` from settingsStore
3. **Fix flashcard 3D flip** — verify `rotateY-180` utility exists or use inline style
4. **Wire Export card action** — `DocumentCard.onExport` should open ExportDialog
5. **Persist font size** — save to localStorage like theme
6. **Live model status in StatusBar** — derive from settingsStore.models
7. **Add keyboard navigation to SearchModal** — ↑↓ and Enter to open
8. **Add document deletion from backend** — call `deleteDocument` IPC + clear FAISS
