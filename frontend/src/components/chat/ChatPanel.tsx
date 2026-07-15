import { useEffect, useRef } from 'react'
import { MessageSquare, Loader2, Plus } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChatStore } from '../../stores/chatStore'
import { useDocumentStore } from '../../stores/documentStore'
import { askAiStream, getChatHistory, saveChatSession } from '../../lib/ipc'
import { CHAT_HISTORY_MAX } from '../../lib/constants'

export function ChatPanel() {
  const {
    activeSessionId,
    sessions,
    isStreaming,
    addMessage,
    createSession,
    setSessions,
    setActiveSession,
    setIsStreaming,
  } = useChatStore()
  const { activeDocument } = useDocumentStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // ponytail: load persisted sessions for the open doc (or start a fresh one)
  useEffect(() => {
    if (!activeDocument) return
    const docId = activeDocument.id
    let cancelled = false
    getChatHistory(docId)
      .then((stored) => {
        if (cancelled) return
        if (stored && stored.length > 0) {
          const restored = stored.map((s) => ({
            id: s.id,
            title: s.title,
            docId,
            messages: (s.messages || []).map((m) => ({
              id: m.id || crypto.randomUUID(),
              role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: m.content,
              timestamp: m.created_at || new Date().toISOString(),
            })),
            created_at: s.created_at,
          }))
          setSessions(restored)
          setActiveSession(restored[0].id)
        } else {
          setSessions([])
          createSession({
            id: crypto.randomUUID(),
            title: `Chat about ${activeDocument.title || activeDocument.filename}`,
            docId,
            messages: [],
            created_at: new Date().toISOString(),
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        setSessions([])
        createSession({
          id: crypto.randomUUID(),
          title: `Chat about ${activeDocument.title || activeDocument.filename}`,
          docId,
          messages: [],
          created_at: new Date().toISOString(),
        })
      })
    return () => {
      cancelled = true
    }
  }, [activeDocument?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  const persistActiveSession = async () => {
    if (!activeSession || !activeDocument) return
    const snapshot = useChatStore.getState().sessions.find((s) => s.id === activeSession.id)
    if (!snapshot) return
    try {
      await saveChatSession(snapshot.id, activeDocument.id, snapshot.title, snapshot.messages)
    } catch {
      // ponytail: persistence is best-effort; ignore failures
    }
  }

  const handleSend = async (message: string) => {
    if (!activeSession) return

    // ponytail: send prior turns so the LLM has conversation context
    const history = activeSession.messages
      .filter((m) => m.content.trim().length > 0)
      .slice(-CHAT_HISTORY_MAX)
      .map((m) => ({ role: m.role, content: m.content }))

    addMessage(activeSession.id, {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    })

    setIsStreaming(true)
    const msgId = crypto.randomUUID()
    addMessage(activeSession.id, {
      id: msgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    })

    let accumulated = ''
    try {
      await askAiStream(
        activeDocument?.id || '',
        message,
        (token) => {
          accumulated += token
          const { updateLastMessage } = useChatStore.getState()
          updateLastMessage(activeSession.id, accumulated)
        },
        () => {},
        history,
      )
    } catch (e) {
      const { updateLastMessage } = useChatStore.getState()
      updateLastMessage(activeSession.id, `Error: ${e}`)
    } finally {
      setIsStreaming(false)
      await persistActiveSession()
    }
  }

  const handleNewChat = () => {
    if (!activeDocument) return
    createSession({
      id: crypto.randomUUID(),
      title: `Chat about ${activeDocument.title || activeDocument.filename}`,
      docId: activeDocument.id,
      messages: [],
      created_at: new Date().toISOString(),
    })
  }

  const docSessions = sessions.filter((s) => s.docId === activeDocument?.id)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-text-primary" />
          <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">AI Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {docSessions.length > 0 && (
            <select
              value={activeSessionId ?? ''}
              onChange={(e) => setActiveSession(e.target.value)}
              className="text-xs bg-bg-secondary border border-border-default text-text-primary rounded-none px-2 py-1 max-w-[160px]"
            >
              {docSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleNewChat}
            title="New chat"
            className="p-1 text-text-tertiary hover:text-text-primary border border-border-default rounded-none"
          >
            <Plus size={14} />
          </button>
          {activeDocument && (
            <span className="text-xs text-text-tertiary truncate max-w-[140px]">
              {activeDocument.title || activeDocument.filename}
            </span>
          )}
        </div>
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
