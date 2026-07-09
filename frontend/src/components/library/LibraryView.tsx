import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { DocumentCard } from './DocumentCard'
import { ExportDialog } from '../document/ExportDialog'
import { useDocumentStore } from '../../stores/documentStore'
import { useUIStore } from '../../stores/uiStore'

interface LibraryViewProps {
  onUpload: () => void
  onDocumentClick: (docId: string) => void
}

export function LibraryView({ onUpload, onDocumentClick }: LibraryViewProps) {
  const { documents, removeDocument, setActiveDocument } = useDocumentStore()
  const { setActiveDocumentId, setCurrentView } = useUIStore()
  const [exportDocId, setExportDocId] = useState<string | null>(null)

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
            onExport={() => {
              setActiveDocument(doc)
              setActiveDocumentId(doc.id)
              setCurrentView('document')
              setExportDocId(doc.id)
            }}
          />
        ))}
      </div>
      {exportDocId && (
        <ExportDialog open={!!exportDocId} onClose={() => setExportDocId(null)} />
      )}
    </div>
  )
}
