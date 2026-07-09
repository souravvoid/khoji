import { X, Clock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { ProgressBar } from '../ui/ProgressBar'
import { PipelineVisualization } from './PipelineVisualization'
import { useDocumentStore } from '../../stores/documentStore'
import { processDocument } from '../../lib/ipc'

const PIPELINE_STAGES = [
  { id: 'ocr', label: 'OCR' },
  { id: 'extract', label: 'Extract' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'chunking', label: 'Chunking' },
  { id: 'embedding', label: 'Embeddings' },
  { id: 'flashcards', label: 'Cards' },
  { id: 'quiz', label: 'Quiz' },
]

export function ProcessingModal() {
  const { processingQueue, removeProcessingJob } = useDocumentStore()

  const activeJob = processingQueue[0]
  if (!activeJob) return null

  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.id === activeJob.stage)
  const stages = PIPELINE_STAGES.map((s, i) => ({
    ...s,
    status: i < stageIndex ? 'completed' as const : i === stageIndex ? 'active' as const : 'pending' as const,
  }))

  return (
    <Modal open={true} onClose={() => {}} title="Processing Document" size="lg">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-primary">{activeJob.filename}</h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              {activeJob.status === 'error' ? 'Processing failed' : 'AI is transforming your document...'}
            </p>
          </div>
          <button
            onClick={() => removeProcessingJob(activeJob.jobId)}
            aria-label="Dismiss processing notification"
            className="p-1.5 hover:bg-surface-hover rounded-none text-text-tertiary cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <PipelineVisualization stages={stages} />

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-tertiary">
            <span>{PIPELINE_STAGES[stageIndex]?.label || 'Processing'}...</span>
            <span>{Math.round(activeJob.progress)}%</span>
          </div>
          <ProgressBar value={activeJob.progress} variant={activeJob.status === 'error' ? 'warning' : 'primary'} />
        </div>

        {activeJob.status === 'processing' && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Clock size={12} />
            <span>Estimated time remaining depends on document size and AI model speed</span>
          </div>
        )}

        {activeJob.error && (
          <div className="p-3 bg-error-500/10 border border-error-500/20 rounded-none text-sm text-error-500">
            {activeJob.error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {activeJob.status === 'error' && (
              <button
                onClick={async () => {
                  if (!activeJob.originalPath) return
                  useDocumentStore.getState().updateProcessingJob(activeJob.jobId, { status: 'queued', progress: 0, error: undefined })
                  try {
                    const result = await processDocument(activeJob.originalPath)
                    if (result?.doc_id) {
                      useDocumentStore.getState().updateProcessingJob(activeJob.jobId, { status: 'complete', progress: 100, docId: result.doc_id })
                    }
                  } catch (e) {
                    useDocumentStore.getState().updateProcessingJob(activeJob.jobId, { status: 'error', progress: 0, error: String(e) })
                  }
                }}
                className="px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-hover rounded-none border border-border-default transition-colors cursor-pointer"
              >
                Retry
              </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
