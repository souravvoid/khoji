# Improvement Backlog - Khoji

**Scope:** Non-bug product/engineering improvements only. Defects (crashes, data
corruption, false-success paths) belong in `BUG_REPORT.md`, not here. Each item lists the
current state, the proposed improvement, a priority, and a rough effort estimate.

Priorities: High / Medium / Low. Effort: S (hours) / M (1-3 days) / L (multi-day).

---

## High priority

### Mind-map renders a flat list instead of a hierarchy
- **Current state:** `MindMapTab.tsx:8-30` parses the Mermaid string by stripping any
  line containing `-->` (line 10) and ignoring edge relationships, so every node becomes a
  top-level node with empty `children`. The backend emits a valid `flowchart LR` with
  `-->` parent/child edges (`pipeline/structure_generator.py:105,111`), but the parser
  discards them. Result: a flat list, not a real tree.
- **Proposed improvement:** Parse the `flowchart` edges (`A --> B`) to reconstruct the
  hierarchy, or skip the custom parser entirely and render the Mermaid directly (e.g.
  mermaid.js live renderer). Preserve topic + nested children as a real tree.
- **Priority:** High (currently broken, borderline bug - listed here per instructions).
- **Effort:** M

---

## Medium priority

### Flashcards: richer review experience
- **Current state:** Simple flip card (`FlashcardsTab.tsx` / `FlashcardReview.tsx`) - one
  front/back with no difficulty signal, progress tracking, or scheduling.
- **Proposed improvement:** Add a difficulty indicator (easy/medium/hard), a progress ring
  showing mastery, spaced-repetition scheduling (SM-2 or similar) so due cards resurface,
  and improved spacing/animation for the flip transition.
- **Priority:** Medium
- **Effort:** M

### Quiz: explanation, timing, and targeted review
- **Current state:** `QuizTab.tsx` presents questions with options and a correct/incorrect
  result; no per-question explanation shown, no timer, no mode to review only wrong answers.
- **Proposed improvement:** Add an explanation-reveal after each answer (the engine already
  returns `explanation` in `handlers.py:119`), a per-question timer, and a
  "review incorrect only" mode that re-queues previously missed questions.
- **Priority:** Medium
- **Effort:** M

### Chat: citations, export, and inline model selector
- **Current state:** `ChatPanel.tsx` streams answers but does not surface source
  references, offers no conversation export, and the model is only selectable from
  Settings.
- **Proposed improvement:** Add citation/reference chips that link to the source page(s)
  (search results already carry `page_number` in `handlers.py:72-74`); add an
  "export conversation" action (markdown/JSON); add an inline model selector in the chat
  header so switching models does not leave the document view.
- **Priority:** Medium
- **Effort:** M

### Search: highlighted snippets and follow-up
- **Current state:** `SearchModal.tsx` returns ranked chunks with `content` and
  `page_number`, but shows no highlighted match snippet and offers no path from a result
  into a follow-up chat.
- **Proposed improvement:** Add a highlighted snippet around the matched term and a
  "page jump" action that opens the document at the result's page; add an "ask follow-up"
  button that seeds a chat with the result as context.
- **Priority:** Medium
- **Effort:** M

### UI: empty states, keyboard-first navigation, and command palette
- **Current state:** Empty collections, no results, and idle panels have no illustrations.
  Navigation is mouse-driven. `ChatInput.tsx:60-62` advertises "Use / for commands" but no
  slash commands are implemented.
- **Proposed improvement:** Add empty-state illustrations for library/search/chat; add
  keyboard-first navigation (j/k or arrow list traversal, `?` for shortcuts); implement a
  command palette (Ctrl/Cmd-K) that backs the advertised `/` commands (new upload, jump to
  doc, generate flashcards/quiz, switch model, toggle theme).
- **Priority:** Medium
- **Effort:** M

### Accessibility: streaming announcements, modal focus trap, keyboard-reachable cards
- **Current state:** Streaming chat/progress state is not announced to screen readers;
  `SettingsDrawer.tsx` modal does not trap focus; `DocumentCard.tsx:42` hover-only action
  button (`opacity-0 group-hover:opacity-100`) is not reachable by keyboard.
- **Proposed improvement:** Announce streaming state via `aria-live` (progress percentage +
  token streaming "generating..."); add a focus trap to the Settings modal; make the
  DocumentCard hover actions visible and operable via keyboard focus (not just
  `group-hover`).
- **Priority:** Medium
- **Effort:** M

### Docs: demo GIF, README screenshots, troubleshooting section
- **Current state:** README has no visual walkthrough and no troubleshooting guide for
  common offline-setup issues (missing OCR engine, model download failures, engine not
  starting).
- **Proposed improvement:** Record a 2-3 minute demo GIF covering upload -> process ->
  chat/flashcards/quiz; add screenshots to the README; add a troubleshooting section
  (OCR engine detection, model download/selection, engine start logs).
- **Priority:** Medium
- **Effort:** S

---

## Low priority

### Notes: edit history and single-section export
- **Current state:** `NotesTab.tsx` is a plain textarea persisted via `saveNotes`
  (`handlers.py:292-299`); no history of edits and no way to copy/export a single section.
- **Proposed improvement:** Add edit history (snapshot/undo or timestamped revisions) and a
  copy/export action for an individual section (heading-delimited block).
- **Priority:** Low
- **Effort:** M

### Performance: LLM pre-warm and per-doc structure caching
- **Current state:** Embeddings are pre-warmed on engine start (`main.py:67-78`), but the
  LLM loads lazily on first chat (cold first response). `generate_timeline` /
  `generate_mindmap` (`handlers.py:268-289`) regenerate from notes on every open with no
  cache.
- **Proposed improvement:** Pre-warm the LLM when a model is first selected (lazy warm on
  `select_model`); cache `generate_timeline` / `generate_mindmap` results per doc (invalidate
  on notes change) to avoid recompute on each tab open.
- **Priority:** Low
- **Effort:** S

---

## Grouped summary

| Priority | Items |
|----------|-------|
| High     | Mind-map hierarchy parsing |
| Medium   | Flashcards SR, Quiz explain/timer, Chat citations/export/model, Search snippets/follow-up, UI empty-state/keyboard/palette, Accessibility, Docs demo/screenshots/troubleshooting |
| Low      | Notes history/section export, Performance pre-warm + structure cache |
