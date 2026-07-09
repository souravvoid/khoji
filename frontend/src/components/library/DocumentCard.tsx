import { FileText, Star, MoreHorizontal } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Dropdown } from '../ui/Dropdown'

interface DocumentCardProps {
  document: {
    id: string
    filename: string
    title: string
    page_count: number
    status: string
    favorite?: boolean
    flashcard_count?: number
    quiz_count?: number
    note_count?: number
  }
  onClick: () => void
  onDelete?: () => void
  onExport?: () => void
}

export function DocumentCard({ document: doc, onClick, onDelete, onExport }: DocumentCardProps) {
  const statusColors = {
    ready: 'success',
    processing: 'warning',
    error: 'error',
    pending: 'neutral',
  } as const

  return (
    <Card variant="interactive" padding="md" onClick={onClick} data-testid="document-card" data-document-id={doc.id} className="group relative border-l-2 hover:border-l-primary-500 transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-none bg-bg-tertiary text-text-primary border border-border-default flex-shrink-0">
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate" data-testid="document-title">{doc.title || doc.filename}</h3>
            <Dropdown
              trigger={
                <button aria-label="Document actions" className="p-1 rounded-none opacity-0 group-hover:opacity-100 hover:bg-surface-hover transition-opacity cursor-pointer">
                  <MoreHorizontal size={14} className="text-text-tertiary" />
                </button>
              }
              items={[
                { label: 'Export', onClick: onExport || (() => {}) },
                { label: 'Delete', onClick: onDelete || (() => {}), variant: 'danger' },
              ]}
              align="right"
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
            <span>{doc.page_count} pages</span>
            {doc.flashcard_count !== undefined && <span>{doc.flashcard_count} cards</span>}
            {doc.quiz_count !== undefined && <span>{doc.quiz_count} quiz</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusColors[doc.status as keyof typeof statusColors] || 'neutral'} size="sm">
              {doc.status}
            </Badge>
            {doc.favorite && <Star size={12} className="text-warning-500 fill-warning-500" />}
          </div>
        </div>
      </div>
    </Card>
  )
}
