# Accessibility Review — Khoji Final QA

Static review of the React/TypeScript frontend (no GUI available, so this is a
source-level audit of keyboard, focus, ARIA, and colour-contrast patterns — not
a live screen-reader pass).

## What's already solid
- **Icon buttons are named.** Every action-only button carries `aria-label`
  (sidebar, document actions, back, copy, send, close, dismiss). See
  `Sidebar.tsx`, `DocumentCard.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`,
  `SearchModal.tsx`, `SettingsDrawer.tsx`, `ProcessingModal.tsx`.
- **Interactive cards are keyboard-operable.** `Card` (interactive variant),
  `UploadZone`, and `FlashcardReview` use `role="button"` + `tabIndex={0}`
  with `onKeyDown` handlers, so they work without a mouse.
- **Focus moves into dialogs.** `SearchModal` focuses its input
  (`inputRef.current?.focus()`) shortly after opening — keyboard users don't
  land on the page underneath.
- **Overlay dialogs are marked.** search/settings backdrops use
  `role="presentation"` and are dismissed via click; (ESC handling is wired in
  the parent state, not the overlay keydown, which is fine).
- **Toggle is a labelled control.** `Toggle.tsx` wraps the input in a
  `<label>`, giving it an accessible name.

## Issues found & fixed
- **Keyboard-only invisible action button (fixed).** `DocumentCard.tsx` had the
  actions button `opacity-0 group-hover:opacity-100` — visible on mouse hover
  but invisible when reached by Tab (no hover). Added `focus:opacity-100` so the
  control becomes visible on keyboard focus. Commit:
  `fix(a11y): reveal document actions on keyboard focus`.

## Known gaps (cannot verify without a running GUI)
- **Colour contrast** of `text-text-tertiary` / `text-text-secondary` tokens
  against `surface`/`surface-hover` was not measured (needs rendered pixels).
  The theme is dark with high-contrast primary text; tertiary labels are the
  usual risk. Recommend a quick contrast scan (e.g. axe DevTools) on the demo
  machine.
- **Focus trap / restore on dialog close** for Search/Settings was not fully
  traced in source; the open-focus is present, but confirm focus returns to the
  trigger on close during the live demo.
- **Live region announcements** for processing/streaming updates are not present;
  chat token streaming and the processing modal would benefit from an
  `aria-live="polite"` region for screen-reader users.

## Verdict
No blocking a11y defects. Keyboard navigation, labelled controls, and dialog
focus-in are present; the one real issue (focus-invisible button) is fixed. The
contrast and live-region items are polish to check on the demo machine.
