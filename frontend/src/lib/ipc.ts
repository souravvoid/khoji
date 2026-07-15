import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { SEARCH_DEFAULT_LIMIT } from './constants'

function canInvoke(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface Flashcard {
  id: string
  front: string
  back: string
  card_type: string
  known?: boolean
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct_answer_index: number
  explanation?: string
}

export interface KhojiDocument {
  id: string
  filename: string
  title: string
  file_path: string
  file_size: number
  mime_type: string
  page_count: number
  status: string
  created_at: string
  updated_at: string
  favorite?: boolean
  notes?: { content: string } | null
  flashcards?: Flashcard[]
  quiz?: QuizQuestion[]
}

export interface SearchHit {
  chunk_id: string
  doc_id: string
  score: number
  content: string
  page_number: number
  doc_title: string
}

export interface TimelineEvent {
  date: string
  title: string
  description: string
}

export interface MindMapNode {
  label: string
  children: MindMapNode[]
}

export interface MindMapTree {
  topic: string
  nodes: MindMapNode[]
}

export interface ChatMessage {
  role: string
  content: string
  id?: string
  created_at?: string
  sources?: unknown
}

export interface ModelInfo {
  id: string
  name: string
  type: 'ocr' | 'embedding' | 'llm'
  size: string
  status: 'downloaded' | 'downloading' | 'not-installed'
  ram_mb: number
  quality: number
  selected: boolean
  progress?: number
}

export interface AskResponse {
  response: string
}

export interface ExportResult {
  filename: string
  content: string
}

export interface ProcessingStatus {
  status: string
}

export interface ProcessingProgress {
  progress: number
}

function parseResponse<T>(raw: unknown): T {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'result' in (parsed as Record<string, unknown>)) {
        return (parsed as { result: T }).result
      }
      return parsed as T
    } catch {
      return raw as T
    }
  }
  if (raw && typeof raw === 'object' && 'result' in (raw as Record<string, unknown>)) {
    return (raw as { result: T }).result
  }
  return raw as T
}

export async function processDocument(filePath: string): Promise<{ doc_id: string }> {
  return parseResponse(await invoke('process_document', { filePath }))
}

export async function searchDocuments(query: string, limit?: number): Promise<SearchHit[]> {
  return parseResponse(await invoke('search_documents', { query, limit: limit ?? SEARCH_DEFAULT_LIMIT }))
}

export async function askAi(docId: string, message: string): Promise<AskResponse> {
  return parseResponse(await invoke('ask_ai', { docId, message }))
}

export async function generateFlashcards(docId: string): Promise<Flashcard[]> {
  return parseResponse(await invoke('generate_flashcards', { docId }))
}

export async function generateQuiz(docId: string, count?: number): Promise<QuizQuestion[]> {
  return parseResponse(await invoke('generate_quiz', { docId, count: count ?? 10 }))
}

export async function getDocuments(): Promise<KhojiDocument[]> {
  if (!canInvoke()) return []
  return parseResponse(await invoke('get_documents'))
}

export async function getDocument(docId: string): Promise<KhojiDocument> {
  return parseResponse(await invoke('get_document', { docId }))
}

export async function deleteDocument(docId: string): Promise<void> {
  await invoke('delete_document', { docId })
}

export interface ExportInclude {
  notes?: boolean
  flashcards?: boolean
  quiz?: boolean
}

export async function exportDocument(
  docId: string,
  format: string,
  include?: ExportInclude,
): Promise<ExportResult> {
  return parseResponse(
    await invoke('export_document', {
      docId,
      format,
      ...(include ? { include } : {}),
    }),
  )
}

export interface ChatHistorySession {
  id: string
  title: string
  created_at: string
  messages: ChatMessage[]
}

export async function getChatHistory(docId: string): Promise<ChatHistorySession[]> {
  return parseResponse(await invoke('get_chat_history', { docId }))
}

export async function saveChatSession(
  sessionId: string,
  docId: string | null,
  title: string,
  messages: ChatMessage[],
): Promise<void> {
  await invoke('save_chat_session', { sessionId, docId, title, messages })
}

export async function getModels(): Promise<ModelInfo[]> {
  if (!canInvoke()) return []
  return parseResponse(await invoke('get_models'))
}

export async function downloadModel(modelId: string): Promise<void> {
  await invoke('download_model', { modelId })
}

export async function selectModel(modelId: string): Promise<{ model_id: string; selected: boolean }> {
  return parseResponse(await invoke('select_model', { modelId }))
}

export async function checkProcessingStatus(docId: string): Promise<ProcessingStatus> {
  return parseResponse(await invoke('check_processing_status', { docId }))
}

export async function getProcessingProgress(docId: string): Promise<ProcessingProgress> {
  return parseResponse(await invoke('get_processing_progress', { docId }))
}

export async function generateTimeline(docId: string): Promise<TimelineEvent[]> {
  return parseResponse(await invoke('generate_timeline', { docId }))
}

export async function generateMindmap(docId: string): Promise<string> {
  return parseResponse(await invoke('generate_mindmap', { docId }))
}

export async function saveNotes(docId: string, content: string): Promise<void> {
  await invoke('save_notes', { docId, content })
}

// ── Streaming IPC ──────────────────────────────────────────────

export async function askAiStream(
  docId: string,
  message: string,
  onToken: (token: string) => void,
  onComplete: () => void,
  history?: ChatMessage[],
): Promise<void> {
  const unlisten = await listen<string>('stream-token', (event) => {
    onToken(event.payload)
  })

  try {
    await invoke('ask_ai_stream', {
      docId,
      message,
      history: history ?? [],
    })
  } finally {
    unlisten()
    onComplete()
  }
}

export async function processDocumentStream(
  filePath: string,
  onProgress: (stage: string, pct: number) => void,
): Promise<{ doc_id: string }> {
  const unlisten = await listen<{ stage: string; pct: number }>('progress-update', (event) => {
    onProgress(event.payload.stage, event.payload.pct)
  })

  try {
    const raw = await invoke('process_document_stream', { filePath })
    return parseResponse<{ doc_id: string }>(raw)
  } finally {
    unlisten()
  }
}
