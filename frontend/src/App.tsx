import { useEffect, useCallback, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { LibraryView } from './components/library/LibraryView'
import { DocumentWorkspace } from './components/document/DocumentWorkspace'
import { UploadZone } from './components/library/UploadZone'
import { useUIStore } from './stores/uiStore'
import { useDocumentStore } from './stores/documentStore'
import { useSettingsStore } from './stores/settingsStore'
import { useKeyboard } from './hooks/useKeyboard'
import { getDocuments, processDocument, getDocument, type KhojiDocument } from './lib/ipc'
import { PROCESSING_JOB_DISMISS_MS } from './lib/constants'

function App() {
  const { currentView, setCurrentView, setActiveDocumentId } = useUIStore()
  const { documents, addDocument, setDocuments, setActiveDocument, addProcessingJob, updateProcessingJob, removeProcessingJob } = useDocumentStore()
  const [showUpload, setShowUpload] = useState(false)

  const fontSize = useSettingsStore((s) => s.fontSize)
  const readingMode = useSettingsStore((s) => s.readingMode)

  useEffect(() => {
    useUIStore.getState().initTheme()
    loadDocuments()
  }, [])

  useEffect(() => {
    const sizeMap = { sm: '13px', md: '15px', lg: '17px', xl: '19px' }
    document.documentElement.style.setProperty('--reading-font-size', sizeMap[fontSize])
    if (readingMode) {
      document.body.classList.add('reading-mode')
    } else {
      document.body.classList.remove('reading-mode')
    }
  }, [fontSize, readingMode])

  useKeyboard()

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments()
      if (docs && docs.length > 0) {
        setDocuments(docs.map((d: KhojiDocument) => ({
          id: d.id,
          filename: d.filename,
          title: d.title || d.filename,
          file_path: d.file_path,
          file_size: d.file_size,
          mime_type: d.mime_type || 'application/pdf',
          page_count: d.page_count,
          status: d.status,
          created_at: d.created_at,
          updated_at: d.updated_at,
          notes: '',
          flashcard_count: 0,
          quiz_count: 0,
          favorite: d.favorite || false,
        })))
      }
    } catch (e) {
      console.error('Failed to load documents:', e)
    }
  }

  const handleFilesSelected = useCallback(async (files: File[]) => {
    for (const file of files) {
      const jobId = crypto.randomUUID()
      addProcessingJob({
        filePath: jobId,
        filename: file.name,
        progress: 0,
        stage: 'ocr',
        status: 'queued',
      })

      try {
        updateProcessingJob(jobId, { stage: 'ocr', status: 'processing', progress: 10 })

        let filePath = ''
        try {
          const { open } = await import('@tauri-apps/plugin-dialog')
          const selected = await open({
            multiple: false,
            filters: [{ name: 'Documents', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'epub'] }]
          })
          if (selected) {
            filePath = selected
          } else {
            updateProcessingJob(jobId, { status: 'error', error: 'File picker unavailable' })
            continue
          }
        } catch {
          updateProcessingJob(jobId, { stage: 'extract', originalPath: file.name, status: 'processing', progress: 30 })
          filePath = file.name
        }

        updateProcessingJob(jobId, { stage: 'processing', originalPath: filePath, status: 'processing', progress: 50 })

        const result = await processDocument(filePath)

        const docId = result?.doc_id
        if (docId) {
          const docData = await getDocument(docId)

          if (docData) {
            addDocument({
              id: docData.id,
              filename: docData.filename,
              title: docData.title || docData.filename,
              file_path: docData.file_path || '',
              file_size: docData.file_size || 0,
              mime_type: docData.mime_type || 'application/pdf',
              page_count: docData.page_count || 0,
              status: docData.status || 'ready',
              created_at: docData.created_at,
              updated_at: docData.updated_at,
              notes: docData.notes?.content || '',
              flashcard_count: docData.flashcards?.length || 0,
              quiz_count: docData.quiz?.length || 0,
              favorite: false,
            })
          }

          updateProcessingJob(jobId, { stage: 'complete', status: 'complete', progress: 100, docId })
          setTimeout(() => removeProcessingJob(jobId), PROCESSING_JOB_DISMISS_MS)
        } else {
          updateProcessingJob(jobId, { status: 'error', error: 'Processing failed - no document ID returned' })
        }
      } catch (e) {
        console.error('Processing failed:', e)
        updateProcessingJob(jobId, { status: 'error', error: String(e) })
      }
    }
  }, [addDocument, addProcessingJob, updateProcessingJob, removeProcessingJob])

  const handleDocumentClick = useCallback(async (docId: string) => {
    const doc = documents.find((d) => d.id === docId)
    if (doc) {
      setActiveDocument(doc)
      setActiveDocumentId(docId)
      setCurrentView('document')

      try {
        const data = await getDocument(docId)
        if (data) {
          const current = useDocumentStore.getState().activeDocument
          if (current && current.id === docId) {
            setActiveDocument({
              ...current,
              notes: data.notes?.content || current.notes || '',
              flashcard_count: data.flashcards?.length || current.flashcard_count || 0,
              quiz_count: data.quiz?.length || current.quiz_count || 0,
            })
          }
        }
      } catch (e) {
        console.error('Failed to fetch document details:', e)
      }
    }
  }, [documents, setActiveDocumentId, setCurrentView, setActiveDocument])

  return (
    <AppShell onUpload={() => setShowUpload(true)}>
      {showUpload ? (
        <div className="h-full overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setShowUpload(false)} aria-label="Back" className="p-1 rounded-md hover:bg-surface-hover text-text-tertiary cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Upload Document</h1>
            </div>
            <UploadZone onFilesSelected={(files) => { handleFilesSelected(files); setShowUpload(false) }} />
            <div className="mt-4 text-xs text-text-tertiary text-center">
              Supported: PDF, PNG, JPG, PPT, PPTX, DOC, DOCX, EPUB
            </div>
          </div>
        </div>
      ) : currentView === 'document' ? (
        <DocumentWorkspace />
      ) : (
        <LibraryView onUpload={() => setShowUpload(true)} onDocumentClick={handleDocumentClick} />
      )}
    </AppShell>
  )
}

export default App
