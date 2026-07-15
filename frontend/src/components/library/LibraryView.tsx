import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { DocumentCard } from './DocumentCard'
import { exportDocument } from '../../lib/ipc'
import { useDocumentStore } from '../../stores/documentStore'

interface LibraryViewProps {
  onUpload: () => void
  onDocumentClick: (docId: string) => void
}

export function LibraryView({ onUpload, onDocumentClick }: LibraryViewProps) {
  const { documents, removeDocument } = useDocumentStore()
  const [exportingId, setExportingId] = useState<string | null>(null)

  const handleExport = async (docId: string, filename: string) => {
    setExportingId(docId)
    try {
      const result = await exportDocument(docId, 'csv')
      const content = result?.content || ''
      const downloadName = result?.filename || `${filename}.csv`
      const blob = new Blob([content], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExportingId(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="library-empty">
        <EmptyState
          icon={<BookOpen size={48} />}
          title="No documents yet"
          description="Drop your first PDF, image, or document to get started. Khoji will transform it into structured knowledge."
          action={{ label: 'Upload Document', onClick: onUpload }}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6" data-testid="library-view">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Library</h1>
        <span className="text-sm text-text-tertiary" data-testid="library-count">{documents.length} documents</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onClick={() => onDocumentClick(doc.id)}
            onDelete={() => removeDocument(doc.id)}
            onExport={() => handleExport(doc.id, doc.title || doc.filename)}
            disabled={exportingId === doc.id}
          />
        ))}
      </div>
    </div>
  )
}
