# 10 — Questions for You

> 50 focused questions across product, technical, and strategic dimensions.
> These must be answered before we write a single line of new code.

---

## Section A: Hackathon Priorities (Questions 1–8)

**1.** What is the judging criteria for OSDHack 2026? Is it technical depth, user experience, completeness, novelty, or a combination? Do you have the rubric?

**2.** Do you have a specific time slot for the demo? How long is the demo (5 minutes? 10 minutes?) and is it live or recorded?

**3.** What is the single most important thing the judges must see in the demo? If you had to reduce the demo to 60 seconds, what would you show?

**4.** Is there a specific "offline AI" requirement that must be demonstrated? For example, must we show network traffic is blocked, or simply state it runs offline?

**5.** Are there co-developers on this project? Or is this a solo submission? This affects how we prioritise what to fix vs. what to leave.

**6.** What is the deadline for code freeze? When does the submission happen?

**7.** Is the project being submitted as open-source? Is the GitHub repository public already?

**8.** Do judges need to be able to install and run the app themselves, or just observe the demo?

---

## Section B: Product Goals (Questions 9–16)

**9.** Who is the primary user persona? Student? Researcher? Professional? This affects which features we polish first.

**10.** Is the "offline-first" aspect more important than "AI quality"? In other words, would you prefer mediocre AI that runs fully offline, or better AI that might need a one-time download?

**11.** Should Khoji focus on one document type (e.g., PDF-only for the demo) or show breadth across all formats?

**12.** Is the flashcard/quiz study flow more important than the AI chat for the demo? Or are they equally important?

**13.** Should the mind map or timeline be shown in the demo? Or are they secondary features?

**14.** Is Anki export a notable differentiator in your target market? Should we highlight it prominently?

**15.** What would make a judge say "I would actually use this"? What's the killer feature?

**16.** Should the UX feel more like a research tool (Notion/Obsidian) or a study tool (Anki/Quizlet)?

---

## Section C: AI Models (Questions 17–24)

**17.** The 900MB LLM model is not downloaded. Do you want to download it? It would give better chat quality than the 0.5B model. The tradeoff: more RAM (~1.2GB vs ~700MB).

**18.** Have you tested AI chat with the existing 0.5B Qwen model? Is the quality acceptable for demo purposes?

**19.** Should we pre-warm the embedding model at app startup (background thread)? This means 60-second startup but instant first document processing. Trade-off: slower cold start.

**20.** Is there a preference for Qwen vs. another GGUF model (e.g., Llama, Mistral, Phi)? Phi-3.5-mini might give better results at similar size.

**21.** Should the chat be "document-aware" only (answers from the current document) or "general AI assistant" (can answer general questions too)? Currently it's document-aware only.

**22.** What's the acceptable response time for the AI chat? 5 seconds? 30 seconds? This determines if we need to implement streaming.

**23.** Should we show the source chunks/citations in the chat response? The backend can return them.

**24.** Is multi-document search important? (e.g., "Find everything about photosynthesis across all my documents") The FAISS index supports this but the frontend doesn't expose it.

---

## Section D: Performance Expectations (Questions 25–30)

**25.** What is the target document size for the demo? The test document is 44 pages. Should we test with a larger document (100+ pages)?

**26.** The embedding model takes ~60 seconds to load on first use. Is this acceptable, or should we pre-warm it? Do users know this happens only once?

**27.** Should we show performance metrics in the demo (e.g., "processed 44 pages in X seconds, generated 20 flashcards")?

**28.** Is there any concern about the app's memory footprint? At peak (both models loaded): ~2GB RAM on an 8GB system. Is this acceptable?

**29.** Should we add a "hardware detection" screen that shows what GPU/CPU will be used? This would impress technically-minded judges.

**30.** How important is startup time? Currently ~2-3 seconds (Python process, DB init). Is this acceptable?

---

## Section E: User Experience (Questions 31–36)

**31.** The sidebar's Learn section (Flashcards, Quiz, Mind Maps, Timeline) currently just navigates to the library. Should clicking "Flashcards" open the flashcards tab of the active document? Or open a library-wide flashcard review?

**32.** Should the search modal use semantic search (FAISS), keyword search (SQL LIKE), or both? Currently it does neither properly.

**33.** Notes editing currently loses changes on navigation (bug). How important is note editing for the demo? This is a 1-hour fix.

**34.** Should we add a "Knowledge Graph" view showing relationships between documents? This was mentioned in the project spec as a potential feature.

**35.** The flashcard review shows session-only stats. Should completion statistics be stored historically ("You've reviewed 150 cards total, 80% accuracy")?

**36.** Should the app show a "first-run setup wizard" for model download and initial configuration?

---

## Section F: Export & Integration (Questions 37–40)

**37.** Who are the intended consumers of exported content? Students who will import to Anki? Researchers who will paste Markdown into Obsidian? This affects export format priorities.

**38.** Should we add Obsidian-compatible Markdown export (with `[[wiki links]]` syntax)?

**39.** Should we add PDF export? (Requires a PDF generation library — added complexity.)

**40.** Is there any integration planned with external services (Notion, Roam, etc.)? Or is everything intentionally offline-only?

---

## Section G: Packaging & Delivery (Questions 41–46)

**41.** What OS will the demo machine run? Fedora Linux (as specified), or is there a chance of Windows/macOS?

**42.** Should we build and test the AppImage before the demo? Running `cargo tauri build` on this machine?

**43.** The Python virtual environment must be bundled with the AppImage. Is there a preferred approach (ship venv, use pyinstaller, or require Python pre-installed)?

**44.** Will the GGUF models be bundled with the AppImage? At 469-591MB each, this makes the AppImage 600MB-1.2GB. Is that acceptable?

**45.** Should there be a "portable" mode where everything (DB, models, vectors) stays in the app directory rather than `~/.khoji/`?

**46.** Should the app auto-update models (check for newer versions on launch), or remain fully static?

---

## Section H: Future Roadmap (Questions 47–52)

**47.** After the hackathon, will this project continue as open source? Should we add a `CONTRIBUTING.md` and `LICENSE`?

**48.** Is there a plan to support cloud models (via API) for users who want better quality and have connectivity? Or is offline-only a permanent constraint?

**49.** Should Khoji support a "plugin system" in the future (custom extractors, custom AI models)? This would affect architecture decisions now.

**50.** Is there a plan for a mobile version (iOS/Android)? Tauri doesn't support mobile well. Would a React Native or Flutter rewrite be considered?

**51.** Is the knowledge graph feature (showing connections between documents and concepts) on the roadmap? FAISS already enables this with similarity clustering.

**52.** Should Khoji eventually support collaborative features (sharing workspaces)? Or does privacy require keeping everything local forever?

---

## Most Critical Questions to Answer First

These 5 questions will most directly affect what we implement next:

| # | Question | Why it matters |
|---|---|---|
| 1 | What is the demo format and duration? | Determines which features must work perfectly |
| 3 | What must judges see in 60 seconds? | Drives feature prioritization |
| 17 | Download the 900MB model? | Affects demo AI quality |
| 22 | Acceptable chat response time? | Determines if streaming is required |
| 31 | Sidebar navigation behaviour? | One of the more visible UX gaps |
