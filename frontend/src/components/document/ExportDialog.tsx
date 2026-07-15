import { useState } from 'react'
import { Download, FileText, Book, Code, GitBranch } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { useDocumentStore } from '../../stores/documentStore'
import { exportDocument as exportDocumentApi } from '../../lib/ipc'

const formats = [
  { id: 'markdown', label: 'Markdown', description: 'Notes + Flashcards + Quiz', icon: FileText, recommended: true },
  { id: 'anki', label: 'Anki', description: 'Flashcard package (TSV)', icon: Book },
  { id: 'json', label: 'JSON', description: 'Structured data', icon: Code },
  { id: 'html', label: 'HTML', description: 'Web page format', icon: FileText },
  { id: 'mermaid', label: 'Mermaid', description: 'Mind map diagram', icon: GitBranch },
]



interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState('markdown')
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeFlashcards, setIncludeFlashcards] = useState(true)
  const [includeQuiz, setIncludeQuiz] = useState(true)
  const [exporting, setExporting] = useState(false)
  const { activeDocument } = useDocumentStore()

  const handleExport = async () => {
    if (!activeDocument) return
    
    setExporting(true)
    try {
      const result = await exportDocumentApi(activeDocument.id, selectedFormat, {
        notes: includeNotes,
        flashcards: includeFlashcards,
        quiz: includeQuiz,
      })
      const content = result?.content || String(result)
      const filename = result?.filename || `${activeDocument.title || 'document'}.${selectedFormat === 'markdown' ? 'md' : selectedFormat}`
      
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Export: ${activeDocument?.title || activeDocument?.filename || 'Document'}`} size="md">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Select Format</h3>
          <div className="grid grid-cols-2 gap-3">
            {formats.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`p-3 border rounded-lg text-left transition-all cursor-pointer ${
                  selectedFormat === fmt.id
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-border-default hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-md ${selectedFormat === fmt.id ? 'bg-primary-100 text-primary-600' : 'bg-bg-tertiary text-text-tertiary'}`}>
                    <fmt.icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text-primary">{fmt.label}</span>
                      {fmt.recommended && <span className="text-xs px-1 py-0.5 bg-primary-100 text-primary-700 rounded-full">Rec</span>}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">{fmt.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Include</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Notes</span>
              <Toggle checked={includeNotes} onChange={setIncludeNotes} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Flashcards</span>
              <Toggle checked={includeFlashcards} onChange={setIncludeFlashcards} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Quiz Questions</span>
              <Toggle checked={includeQuiz} onChange={setIncludeQuiz} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border-default">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon={<Download size={16} />} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
