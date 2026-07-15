import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileEdit, Eye, Loader2 } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { getDocument } from '../../lib/ipc'

interface NotesTabProps {
  docId: string
  onEdit?: (content: string) => void
}

export function NotesTab({ docId, onEdit }: NotesTabProps) {
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDocument(docId)
      .then((doc) => {
        if (!cancelled) setContent(doc?.notes?.content || '')
      })
      .catch(() => {
        if (!cancelled) setContent('')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [docId])

  useEffect(() => {
    setEditContent(content)
    setEditing(false)
  }, [content])

  const handleSave = () => {
    onEdit?.(editContent)
    setContent(editContent)
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        No notes generated yet. Process a document to see AI-generated notes.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-default">
        <span className="text-xs text-text-tertiary">
          {editing ? 'Editing' : 'Preview'}
        </span>
        <div className="flex gap-1">
          {onEdit && (
            <IconButton
              icon={editing ? <Eye size={16} /> : <FileEdit size={16} />}
              label={editing ? 'Preview' : 'Edit'}
              onClick={() => editing ? setEditing(false) : setEditing(true)}
              size="sm"
            />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full bg-transparent text-sm text-text-primary font-mono resize-none outline-none"
            onBlur={handleSave}
          />
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-primary-500 prose-strong:text-text-primary prose-code:text-primary-600 prose-pre:bg-bg-secondary prose-pre:border prose-pre:border-border-default">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  )
}
