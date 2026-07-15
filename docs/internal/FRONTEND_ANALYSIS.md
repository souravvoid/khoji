# Frontend Analysis

## Overview

The frontend is a **React 19 + TypeScript** single-page application running inside a **Tauri v2** WebView. It uses **Vite 8** for bundling, **Tailwind CSS v4** for styling, **Zustand** for state management, and follows a **BMW M-inspired "industrial precision"** design aesthetic.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI rendering |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build tool, dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Zustand | Latest | State management |
| Tauri API | v2 | Desktop integration |
| react-markdown | Latest | Markdown rendering |
| oxlint | Latest | Linting |
| Playwright | Latest | E2E testing |

## Application Shell

```
┌─────────────────────────────────────────────────────────────┐
│ AppShell                                                     │
├──────┬──────────────────────────────────────────────────────┤
│      │ TopBar (56px)                                         │
│ Side │  [Khoji Logo]  [Search Bar (⌘K)]  [Upload Button]   │
│ bar  ├──────────────────────────────────────────────────────┤
│ 260/ │ Main Content Area                                     │
│ 56px │  ┌──────────────────────┬─────────────────────────┐  │
│      │  │ DocumentWorkspace    │ ChatPanel (when open)    │  │
│      │  │  [Back] [Title]     │                         │  │
│      │  │  [Export]           │  [Messages]              │  │
│      │  │                     │  [Input]                 │  │
│      │  │  [Tabs]             │                         │  │
│      │  │  [Tab Content]      │                         │  │
│      │  └──────────────────────┴─────────────────────────┘  │
│      ├──────────────────────────────────────────────────────┤
│      │ StatusBar (28px)                                      │
│      │  [CPU] [Active Model] [Doc Count]                    │
├──────┴──────────────────────────────────────────────────────┤
│ SearchModal (overlay, when open)                             │
│ SettingsDrawer (right slide-in, when open)                   │
│ ProcessingModal (bottom, when jobs active)                   │
└─────────────────────────────────────────────────────────────┘
```

## Five Zustand Stores

### 1. uiStore — UI Chrome State

```typescript
{
  theme: 'light' | 'dark' | 'system'
  resolvedTheme: 'light' | 'dark'
  sidebarOpen: boolean
  chatOpen: boolean
  searchOpen: boolean
  settingsOpen: boolean
  currentView: 'library' | 'document' | 'settings'
  activeDocumentId: string | null
  activeTab: string
}
```

Actions: `setTheme`, `toggleDarkMode`, `toggleSidebar`, `toggleChat`, `setSearchOpen`, `setSettingsOpen`, `setCurrentView`, `setActiveDocumentId`, `setActiveTab`, `initTheme`

### 2. documentStore — Documents & Processing

```typescript
{
  documents: Document[]
  activeDocument: Document | null
  processingQueue: ProcessingJob[]
  loading: boolean
}
```

ProcessingJob: `{ jobId, filename, originalPath?, progress, stage, status, error?, docId? }`

Actions: `setDocuments`, `addDocument`, `removeDocument`, `setActiveDocument`, `addProcessingJob`, `updateProcessingJob`, `removeProcessingJob`, `setLoading`

### 3. chatStore — Chat Sessions

```typescript
{
  sessions: ChatSession[]
  activeSessionId: string | null
  isStreaming: boolean
}
```

ChatSession: `{ id, title, docId, messages: ChatMessage[], created_at }`

Actions: `setSessions`, `setActiveSession`, `addMessage`, `updateLastMessage`, `createSession`, `setIsStreaming`, `getActiveSession`

### 4. settingsStore — Settings & Models

```typescript
{
  modelSearchOpen: boolean
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  readingMode: boolean
  autoExport: boolean
  startUp: 'library' | 'last-document'
  models: ModelInfo[]
}
```

ModelInfo: `{ id, name, type, size, status, ram_mb, quality, selected, progress? }`

Actions: `setModelSearchOpen`, `setFontSize`, `setReadingMode`, `setAutoExport`, `setStartUp`, `setModels`, `updateModel`

### 5. reviewStore — Flashcard Review

```typescript
{
  queue: Flashcard[]
  currentIndex: number
  flipped: boolean
  isActive: boolean
  stats: ReviewStats
}
```

Actions: `startReview`, `flip`, `rate`, `nextCard`, `endReview`

## IPC Layer (`lib/ipc.ts`)

18 invoke commands mapped to Tauri commands:

| Function | Command | Input | Returns |
|----------|---------|-------|---------|
| `processDocument` | `process_document` | `{ filePath }` | `{ doc_id }` |
| `searchDocuments` | `search_documents` | `{ query, limit }` | `SearchHit[]` |
| `askAi` | `ask_ai` | `{ docId, message }` | `AskResponse` |
| `generateFlashcards` | `generate_flashcards` | `{ docId }` | `Flashcard[]` |
| `generateQuiz` | `generate_quiz` | `{ docId, count }` | `QuizQuestion[]` |
| `getDocuments` | `get_documents` | — | `KhojiDocument[]` |
| `getDocument` | `get_document` | `{ docId }` | `KhojiDocument` |
| `deleteDocument` | `delete_document` | `{ docId }` | `void` |
| `exportDocument` | `export_document` | `{ docId, format }` | `ExportResult` |
| `getChatHistory` | `get_chat_history` | `{ docId }` | `ChatMessage[]` |
| `getModels` | `get_models` | — | `ModelInfo[]` |
| `downloadModel` | `download_model` | `{ modelId }` | `void` |
| `selectModel` | `select_model` | `{ modelId }` | `{ model_id, selected }` |
| `checkProcessingStatus` | `check_processing_status` | `{ docId }` | `ProcessingStatus` |
| `getProcessingProgress` | `get_processing_progress` | `{ docId }` | `ProcessingProgress` |
| `generateTimeline` | `generate_timeline` | `{ docId }` | `TimelineEvent[]` |
| `generateMindmap` | `generate_mindmap` | `{ docId }` | `string` (Mermaid) |
| `saveNotes` | `save_notes` | `{ docId, content }` | `void` |

`parseResponse<T>()` helper unwraps `{ result: T }` envelopes and handles string-JSON parsing.

## Component Inventory

### UI Primitives (13)

| Component | Purpose |
|-----------|---------|
| `Badge` | Status labels (6 variants, 2 sizes) |
| `Button` | CTA buttons (4 variants, 4 sizes, loading state) |
| `Card` | Containers (default, interactive) |
| `Dropdown` | Click-triggered popover menus |
| `EmptyState` | Placeholder with optional CTA |
| `IconButton` | Icon-only buttons (accessible) |
| `Input` | Text inputs with icon, error, clearable |
| `Modal` | Centered overlay dialogs (5 sizes) |
| `ProgressBar` | Horizontal bars (M-stripe gradient) |
| `Skeleton` | Pulse-animated placeholders |
| `Spinner` | CSS-animated spinning rings |
| `Tabs` | Horizontal tab bars (M-stripe underline) |
| `Toggle` | Sliding switch checkboxes |

All components: `rounded-none` (zero border-radius), BMW M aesthetic.

### Feature Components (18)

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppShell` | layout/ | Root layout with sidebar, topbar, statusbar |
| `Sidebar` | layout/ | Navigation (260px/56px collapsible) |
| `TopBar` | layout/ | Search bar, upload button |
| `StatusBar` | layout/ | CPU, model, doc count |
| `LibraryView` | library/ | Document grid with upload zone |
| `DocumentCard` | library/ | Document card with status badge |
| `UploadZone` | library/ | Drag-and-drop upload area |
| `DocumentWorkspace` | document/ | Tab container for document content |
| `NotesTab` | document/ | Markdown editor/preview |
| `FlashcardsTab` | document/ | Flashcard list + review trigger |
| `QuizTab` | document/ | Quiz config → active → result |
| `TimelineTab` | document/ | Vertical timeline visualization |
| `MindMapTab` | document/ | Mermaid-based tree visualization |
| `OutlinePanel` | document/ | Section navigation sidebar |
| `ExportDialog` | document/ | Multi-format export modal |
| `ChatPanel` | chat/ | AI chat interface |
| `ChatInput` | chat/ | Auto-resizing textarea |
| `ChatMessage` | chat/ | Message bubbles with markdown |
| `SearchModal` | search/ | Debounced search overlay |
| `SearchResultItem` | search/ | Search result with score bar |
| `ModelManager` | settings/ | Model list with download/select |
| `ModelCard` | settings/ | Individual model card |
| `SettingsDrawer` | settings/ | Right slide-in settings panel |
| `ProcessingModal` | processing/ | Processing queue display |
| `PipelineVisualization` | processing/ | 7-stage pipeline display |
| `FlashcardReview` | review/ | Full-screen SRS review |
| `RatingButtons` | review/ | Again/Hard/Good/Easy buttons |
| `ReviewStats` | review/ | Review completion stats |

### Keyboard Shortcuts (6)

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Open search |
| `⌘/Ctrl + ,` | Open settings |
| `⌘/Ctrl + B` | Toggle sidebar |
| `⌘/Ctrl + D` | Toggle dark mode |
| `⌘/Ctrl + Shift + L` | Toggle chat |
| `⌘/Ctrl + 1` | Navigate to library |

## Design System

### BMW M Aesthetic

- **Zero border-radius**: `rounded-none` everywhere
- **M tricolor stripe**: Blue (#0066b1), Dark Blue (#1c69d4), Red (#e22718)
- **Uppercase labels**: `tracking-widest uppercase`
- **Black canvas**: Near-black backgrounds, white text
- **Glass effects**: Frosted glass overlays

### Design Tokens (`styles/tokens.css`)

60+ CSS custom properties:
- Typography: Inter (sans), JetBrains Mono (mono), Source Serif 4 (serif)
- Animation: 5 duration levels (100ms-500ms), spring easing
- Z-index: 7 levels (base to tooltip)
- Colors: BMW M accent palette

### Theme System

Three themes: `light`, `dark`, `system`
- Applied via `data-theme` attribute on `<html>`
- `.dark` class for Tailwind dark mode
- `matchMedia` listener for system theme changes

## E2E Test Coverage

### Framework
- Playwright with Page Object Model
- Chromium + Firefox (configured, only Chromium runs in CI)

### Test Suites

**library.spec.ts** (3 tests):
- Renders seeded documents
- Shows document count
- Opens document into workspace

**document.spec.ts** (4 tests):
- Opens with correct title
- Switches to flashcards tab
- Switches to quiz tab
- Returns to library on back

**settings.spec.ts** (5 tests):
- Opens settings drawer
- Switches between sections
- Changes theme to dark
- Changes font size
- Closes drawer

**search.spec.ts** (5 tests):
- Opens via top bar button
- Opens via Ctrl+K shortcut
- Returns matching results
- Shows no results for bad query
- Closes on Escape

### Coverage Gaps

No tests for: chat, flashcard review, quiz flow, mind map, timeline, export dialog, processing modal, upload flow, document deletion, keyboard shortcuts beyond search.

### Mock System

`tauriMock.ts` injects `window.__TAURI_INTERNALS__` with in-memory mocks of all IPC commands. Seeds 2 documents, 4 search chunks, flashcards, quiz questions, timeline events.
