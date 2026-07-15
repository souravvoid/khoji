import { useState, useCallback } from 'react'
import { ArrowLeft, FileText, Layers, HelpCircle, GitBranch, Clock, Download } from 'lucide-react'
import { Tabs } from '../ui/Tabs'
import { IconButton } from '../ui/IconButton'
import { NotesTab } from './NotesTab'
import { FlashcardsTab } from './FlashcardsTab'
import { QuizTab } from './QuizTab'
import { MindMapTab } from './MindMapTab'
import { TimelineTab } from './TimelineTab'
import { ExportDialog } from './ExportDialog'
import { ChatPanel } from '../chat/ChatPanel'
import { useUIStore } from '../../stores/uiStore'
import { useDocumentStore } from '../../stores/documentStore'
import { saveNotes as saveNotesApi } from '../../lib/ipc'

const workspaceTabs = [
  { value: 'notes', label: 'Notes', icon: <FileText size={16} /> },
  { value: 'flashcards', label: 'Flashcards', icon: <Layers size={16} /> },
  { value: 'quiz', label: 'Quiz', icon: <HelpCircle size={16} /> },
  { value: 'mindmap', label: 'Mind Map', icon: <GitBranch size={16} /> },
  { value: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
]

export function DocumentWorkspace() {
  const { activeTab, setActiveTab, chatOpen, toggleChat, setCurrentView, setActiveDocumentId } = useUIStore()
  const { activeDocument } = useDocumentStore()
  const [exportOpen, setExportOpen] = useState(false)

  const handleBack = () => {
    setActiveDocumentId(null)
    setCurrentView('library')
  }

  const handleSaveNotes = useCallback(async (content: string) => {
    if (!activeDocument) return
    try {
      await saveNotesApi(activeDocument.id, content)
      useDocumentStore.getState().setActiveDocument({
        ...activeDocument,
        notes: content,
      })
    } catch (e) {
      console.error('Failed to save notes:', e)
    }
  }, [activeDocument])

  if (!activeDocument) return null

  return (
    <div className="h-full flex flex-col" data-testid="document-workspace">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default bg-bg-primary">
        <button onClick={handleBack} aria-label="Back to library" className="p-1 rounded-none hover:bg-surface-hover text-text-tertiary cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-none bg-bg-tertiary text-text-primary border border-border-default">
            <FileText size={16} />
          </div>
          <h2 className="text-sm font-semibold text-text-primary truncate" data-testid="document-title">
            {activeDocument.title || activeDocument.filename}
          </h2>
        </div>
        <IconButton icon={<Download size={16} />} label="Export" onClick={() => setExportOpen(true)} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs tabs={workspaceTabs} value={activeTab} onChange={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            {activeTab === 'notes' && <NotesTab docId={activeDocument.id} onEdit={handleSaveNotes} />}
            {activeTab === 'flashcards' && <FlashcardsTab />}
            {activeTab === 'quiz' && <QuizTab />}
            {activeTab === 'mindmap' && <MindMapTab />}
            {activeTab === 'timeline' && <TimelineTab />}
          </div>
        </div>

        {chatOpen && (
          <div className="w-80 border-l border-border-default bg-bg-primary">
            <ChatPanel />
          </div>
        )}
      </div>

      {!chatOpen && (
        <button
          onClick={toggleChat}
          className="absolute right-4 bottom-12 px-4 py-2 bg-text-primary text-text-inverse rounded-none hover:bg-transparent hover:text-text-primary border border-text-primary text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
        >
          AI Chat
        </button>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
