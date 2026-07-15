# KHOJI — MVP Refinement Plan

## Current State
- **MVP complete**: Document import, OCR, extraction, markdown, flashcards, quiz, search, chat, timeline, mind map, export, model management
- **Tech**: Tauri v2 + React 19 + Python 3.14 + SQLite + FAISS + llama-cpp-python
- **Design**: BMW M aesthetic (zero border-radius, M tricolor, dark/light/system themes)
- **Backend**: 20 IPC handlers, rule-based flashcard/quiz/timeline generation, sentence-transformers embeddings

## Feature Inventory (All Working)

| Feature | Status | Notes |
|---------|--------|-------|
| Document import | Working | PDF/DOCX/PPTX/EPUB/Image via drag-drop + file picker |
| OCR pipeline | Working | RapidOCR > Tesseract fallback |
| Markdown notes | Working | Edit/preview toggle, auto-save |
| Flashcards | Working | Rule-based generation, SM-2 spaced repetition review |
| Quiz | Working | MCQ generation, config/active/result views |
| Semantic search | Working | all-MiniLM-L6-v2 + FAISS, debounced input |
| AI Chat | Working | RAG with local LLM, session management |
| Timeline | Working | Date-extraction from text |
| Mind Map | Working | Mermaid parsing, zoom controls, export |
| Export | Working | 8 formats: Markdown/HTML/JSON/Anki/CSV/Mermaid/Flashcard/Quiz |
| Model management | Working | Download/select GGUF models |
| Settings | Working | Theme, font size, reading mode, shortcuts, accessibility |
| Pipeline visualization | Working | 7-stage horizontal indicator with progress |

## Polish Plan (implementation order)

### 1. Processing Pipeline Stages
**Problem**: Pipeline shows generic labels (OCR, Extract, Cards, Quiz). User doesn't understand what's happening.
**Fix**: Use descriptive stage labels that communicate progress meaningfully. Map backend stages to more descriptive UI labels.

### 2. Backend Prompt Quality
**Problem**: Rule-based flashcard/quiz generation is basic — simple definition extraction and number-blanking.
**Fix**: Improve `_is_definition`, `_is_fact`, and `_fact_to_card` to produce more meaningful content. Better distractor selection for quiz.

### 3. Flashcard Review Polish
**Problem**: Flip animation works but card layout, spacing, and completion screen are basic.
**Fix**: Polish spacing, typography hierarchy, transition on rating, completion screen with better stats.

### 4. Quiz Polish
**Problem**: Explanation shown below options, no timer, result screen is basic.
**Fix**: Better explanation card styling, keyboard navigation (1-4), polished result screen with per-question breakdown.

### 5. Notes Polish
**Problem**: Markdown rendering uses default prose styles, no Mermaid rendering.
**Fix**: Add remark plugins for tables, better code blocks. Add Mermaid diagram rendering.

### 6. Chat Polish
**Problem**: No copy button, streaming is placeholder-only (no real streaming from backend).
**Fix**: Add copy button on assistant messages, show citations better, polish typing indicator.

### 7. Search Polish
**Problem**: Score bar is thin, no highlight matching in results.
**Fix**: Bold/emphasize matching terms in snippets. Better relevance visual.

### 8. Timeline Polish
**Problem**: Basic vertical timeline, no animation.
**Fix**: Add hover feedback, subtle entrance animation, better date badge styling.

### 9. Mind Map Polish
**Problem**: No mouse-wheel zoom, node layout is simple.
**Fix**: Add scroll-to-zoom, better node spacing, hover effects, transition on zoom.

### 10. Library Polish
**Problem**: Document cards are text-heavy, no thumbnails, limited status info.
**Fix**: Better status badges with icons, processing indicator, thumbnail area placeholder.

## Testing Strategy
- After each refinement batch: run `npm run build` (frontend), `./verify.sh` (backend)
- Full E2E test at end: import PDF, OCR, flashcards, quiz, search, chat, export
- Check theme switching, window resize, keyboard shortcuts

## Risk Assessment
- **Low**: UI-only changes (spacing, animation, labels) — easy to revert
- **Medium**: Backend prompt changes — affects generated content quality
- **Low**: All changes are incremental, no architectural changes

## Rollback Plan
- Each refinement committed separately: `git revert <sha>` for any isolated change

## Acceptance Criteria
- All existing features still work
- No console errors
- Pipeline communicates progress meaningfully
- Flashcards/quiz content is higher quality
- UI interactions feel smoother
- No regressions in test suite
