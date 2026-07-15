# Khoji — Live Demo Checklist

A step-by-step script for a presenter to demonstrate Khoji end-to-end **without restarting the app**. Follow it in order. Steps marked RISKY must be approached carefully; the safe alternative is given.

## Pre-demo MUST-DO (run before the presentation)

Khoji is OFFLINE. On first run, if no models are present, it tries to download from HuggingFace over the network. If that download fails (no/weak network, blocked CDN), the app degrades silently: search returns empty results and chat reports "The AI model is not loaded." To guarantee a fully working offline demo:

1. **Pre-stage the embedding model.** Ensure `~/.cache/huggingface/` (or the sentence-transformers cache) already contains `all-MiniLM-L6-v2` so embeddings/search work with zero network.
2. **Pre-stage at least one LLM GGUF.** Place a GGUF in `~/.khoji/models/`, e.g. `qwen2.5-0.5b-instruct-q4_k_m.gguf` (filename per `backend/python/khoji_engine/ai/llm.py:27-33`). Khoji auto-detects existing files and skips download (`llm.py:116-118`).
3. **Pre-import the demo document** (recommended): open the app once, import the sample PDF, let OCR + notes + flashcards + quiz finish, then close. This way the document is already in `~/.khoji/khoji.db` and the demo is instant and deterministic.
4. **Verify offline:** disconnect Wi-Fi and launch the AppImage. Confirm the library shows the pre-imported doc and that no download spinner appears. If a download prompt appears, you are NOT ready — go back to step 1-2.

> Why this matters: `handle_download_model` (`handlers.py:233-241`) reports success even when the download fails, so a judge who triggers a download on a bad network sees a false "downloaded" state and a broken model. Pre-staging avoids this entirely.

## Demo Script (in-app, no restart)

1. **Launch the app.** Double-click `Khoji_1.0.0_amd64.AppImage`. UI visible in ~1 sec. Confirm library loads with the pre-staged document.
2. **Import a PDF.** Use the Upload/Import control (file dialog). Watch the `progress-update` events: OCR → Extract → Markdown → Chunk → Embed → Content. For a text PDF this is near-instant; for a scanned PDF, OCR takes 30-60 sec for 10 pages.
3. **Watch OCR + Markdown notes.** Open the document. Confirm generated Markdown notes appear and are editable (Save via `handle_save_notes`).
4. **Open Flashcards review.** Trigger `generate_flashcards` (handler `handlers.py:79-97`). 20 rule-based cards. Review with the flip/SM-2 UI.
   - WARNING: Do NOT click "generate" twice without clearing — regenerating appends DUPLICATE rows (`handlers.py:79-121` add-without-clear). Click once.
5. **Take a Quiz.** Trigger `generate_quiz` (`handlers.py:100-121`). 10 MCQ. Answer and view explanation.
6. **Ask the AI Chat a follow-up (show multi-turn).** Open chat, ask question 1 about the doc, then ask a follow-up that references the prior answer. Streaming tokens appear live (`lib.rs:209-214` emits `stream-token`). The `history` payload (`handlers.py:351-355`) gives multi-turn context.
   - RISKY if no LLM staged: chat will say "The AI model is not loaded." (Mitigated by Pre-demo step 2.)
7. **Semantic Search.** Type a query; results return in ~60ms (`handlers.py:41-76`). Click a result to jump to the chunk.
   - RISKY if embedding model not staged: search returns empty. (Mitigated by Pre-demo step 1.)
8. **Export Markdown.** Open the DOCUMENT view for the doc, click its Export button, choose Markdown, click Export. File downloads.
   - **DO NOT use the Library card's export button** — it is BROKEN: switching to the document view unmounts `LibraryView`, so the `ExportDialog` (rendered inside `LibraryView.tsx:54-56`) never opens (`LibraryView.tsx:45-56`).
   - NOTE: the "Include Notes/Flashcards/Quiz" toggles in the dialog are DEAD and do nothing (`ExportDialog.tsx:26-28, 32-37`); the export always includes everything.

## Things to AVOID showing (known broken / stub)

- **Library export button** (broken — see step 8).
- **Sidebar Flashcards / Quiz / MindMaps / Timeline / Chat tabs** (stubs; do not click expecting functional panels).
- **Reading-mode and font-size settings** (no visual effect).
- **Mind-map** as a tree (renders flat).
- **In-app model download** during the demo (false-success on failure; pre-stage instead).

## Rollback if something misbehaves live

- If the engine appears frozen: a hung Python child has no auto-restart and no stdout read timeout (`lib.rs:151-154,179-185`). You must close and relaunch the AppImage. Keep a second pre-launched instance or a backup machine ready.
- If chat says "model not loaded": the LLM GGUF is missing from `~/.khoji/models/`. Point the judge to Settings > Models only if a model is already present.
