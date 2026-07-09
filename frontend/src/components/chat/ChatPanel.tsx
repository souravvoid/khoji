import { useEffect, useRef } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChatStore } from '../../stores/chatStore'
import { useDocumentStore } from '../../stores/documentStore'
import { askAi } from '../../lib/ipc'

export function ChatPanel() {
  const { activeSessionId, sessions, isStreaming, addMessage, createSession, setIsStreaming } = useChatStore()
  const { activeDocument } = useDocumentStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  useEffect(() => {
    if (!activeSessionId && activeDocument) {
      createSession({
        id: crypto.randomUUID(),
        title: `Chat about ${activeDocument.title || activeDocument.filename}`,
        docId: activeDocument.id,
        messages: [],
        created_at: new Date().toISOString(),
      })
    }
  }, [activeDocument, activeSessionId, createSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  const handleSend = async (message: string) => {
    if (!activeSession) return

    addMessage(activeSession.id, {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    })

    setIsStreaming(true)
    addMessage(activeSession.id, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    })

    try {
      const result = await askAi(activeDocument?.id || '', message)
      const response = result?.response || String(result)
      
      const { updateLastMessage } = useChatStore.getState()
      updateLastMessage(activeSession.id, response)
    } catch (e) {
      const { updateLastMessage } = useChatStore.getState()
      updateLastMessage(activeSession.id, `Error: ${e}`)
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-text-primary" />
          <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">AI Chat</span>
        </div>
        {activeDocument && (
          <span className="text-xs text-text-tertiary truncate max-w-[140px]">
            {activeDocument.title || activeDocument.filename}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeSession && activeSession.messages.length > 0 ? (
          <div className="p-4 space-y-4">
            {activeSession.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-tertiary">
                <Loader2 size={14} className="animate-spin" />
                <span>Khoji is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-12 h-12 rounded-none bg-bg-tertiary border border-border-default flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Chat with AI</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Ask questions about this document. The AI will use the document content to provide answers with citations.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border-default">
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  )
}
