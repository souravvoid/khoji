export const APP_NAME = 'Khoji'
export const APP_VERSION = '1.0.0'
export const APP_TAGLINE = 'Offline AI Knowledge Workspace'

// Timers
export const PROCESSING_JOB_DISMISS_MS = 3000
export const SEARCH_FOCUS_DELAY_MS = 50
export const SEARCH_DEBOUNCE_MS = 300

// Search tuning
export const SEARCH_MIN_QUERY_LENGTH = 2
export const SEARCH_SNIPPET_LENGTH = 200
export const SEARCH_DEFAULT_LIMIT = 10

// Quiz scoring thresholds (percentages)
export const QUIZ_PASS_PERCENTAGE = 80
export const QUIZ_NEAR_PASS_PERCENTAGE = 50
export const QUIZ_RESULT_LABEL_MAX = 50

// Mind map zoom bounds
export const MINDMAP_MIN_ZOOM = 50
export const MINDMAP_MAX_ZOOM = 200
export const MINDMAP_DEFAULT_ZOOM = 100
export const MINDMAP_MAX_NODES = 8

export const SUPPORTED_FORMATS = ['PDF', 'PNG', 'JPG', 'JPEG', 'PPT', 'PPTX', 'DOC', 'DOCX', 'EPUB'] as const
export const ACCEPTED_MIME_TYPES = '.pdf,.png,.jpg,.jpeg,.ppt,.pptx,.doc,.docx,.epub'

export const PIPELINE_STAGES = [
  { id: 'ocr', label: 'OCR & Layout Analysis', icon: 'scan' },
  { id: 'extract', label: 'Text Extraction', icon: 'file-text' },
  { id: 'markdown', label: 'Markdown Generation', icon: 'file-edit' },
  { id: 'chunking', label: 'Chunking', icon: 'columns' },
  { id: 'embedding', label: 'Embeddings', icon: 'cpu' },
  { id: 'flashcards', label: 'Flashcard Generation', icon: 'layers' },
  { id: 'quiz', label: 'Quiz Generation', icon: 'help-circle' },
  { id: 'complete', label: 'Complete', icon: 'check-circle' },
] as const

export const KEYBOARD_SHORTCUTS = {
  search: { key: 'k', mod: true, label: 'Quick Search' },
  settings: { key: ',', mod: true, label: 'Settings' },
  upload: { key: 'u', mod: true, shift: true, label: 'Upload Document' },
  toggleSidebar: { key: 'b', mod: true, label: 'Toggle Sidebar' },
  toggleChat: { key: 'l', mod: true, shift: true, label: 'Toggle Chat Panel' },
  toggleDarkMode: { key: 'd', mod: true, label: 'Toggle Dark Mode' },
  navigateLibrary: { key: '1', mod: true, label: 'Library' },
} as const
