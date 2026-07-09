import { create } from 'zustand'
import { deleteDocument as deleteDocumentApi } from '../lib/ipc'

interface Document {
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
  notes?: string
  flashcard_count?: number
  quiz_count?: number
  chunk_count?: number
  favorite?: boolean
}

interface ProcessingJob {
  filePath: string
  filename: string
  originalPath?: string
  progress: number
  stage: string
  status: 'queued' | 'processing' | 'complete' | 'error'
  error?: string
  docId?: string
}

interface DocumentState {
  documents: Document[]
  activeDocument: Document | null
  processingQueue: ProcessingJob[]
  loading: boolean
  setDocuments: (docs: Document[]) => void
  addDocument: (doc: Document) => void
  removeDocument: (id: string) => Promise<void>
  setActiveDocument: (doc: Document | null) => void
  addProcessingJob: (job: ProcessingJob) => void
  updateProcessingJob: (filePath: string, updates: Partial<ProcessingJob>) => void
  removeProcessingJob: (filePath: string) => void
  setLoading: (loading: boolean) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  activeDocument: null,
  processingQueue: [],
  loading: false,

  setDocuments: (documents) => set({ documents }),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  removeDocument: async (id) => {
    try {
      await deleteDocumentApi(id)
    } catch (e) {
      console.error('Failed to delete document from backend:', e)
    }
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      activeDocument: s.activeDocument?.id === id ? null : s.activeDocument,
    }))
  },
  setActiveDocument: (doc) => set({ activeDocument: doc }),

  addProcessingJob: (job) => set((s) => ({
    processingQueue: [...s.processingQueue, job],
  })),

  updateProcessingJob: (filePath, updates) => set((s) => ({
    processingQueue: s.processingQueue.map((j) =>
      j.filePath === filePath ? { ...j, ...updates } : j
    ),
  })),

  removeProcessingJob: (filePath) => set((s) => ({
    processingQueue: s.processingQueue.filter((j) => j.filePath !== filePath),
  })),

  setLoading: (loading) => set({ loading }),
}))
