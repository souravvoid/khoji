import { create } from 'zustand'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { page: number; text: string }[]
  timestamp: string
}

interface ChatSession {
  id: string
  title: string
  docId: string | null
  messages: ChatMessage[]
  created_at: string
}

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  isStreaming: boolean
  setSessions: (sessions: ChatSession[]) => void
  setActiveSession: (id: string | null) => void
  addMessage: (sessionId: string, message: ChatMessage) => void
  updateLastMessage: (sessionId: string, content: string) => void
  createSession: (session: ChatSession) => void
  setIsStreaming: (streaming: boolean) => void
  getActiveSession: () => ChatSession | undefined
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,

  setSessions: (sessions) => set({ sessions }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  addMessage: (sessionId, message) => set((s) => ({
    sessions: s.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, messages: [...session.messages, message] }
        : session
    ),
  })),

  updateLastMessage: (sessionId, content) => set((s) => ({
    sessions: s.sessions.map((session) => {
      if (session.id !== sessionId) return session
      const messages = [...session.messages]
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: messages[messages.length - 1].content + content,
        }
      }
      return { ...session, messages }
    }),
  })),

  createSession: (session) => set((s) => ({
    sessions: [...s.sessions, session],
    activeSessionId: session.id,
  })),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get()
    return sessions.find((s) => s.id === activeSessionId)
  },
}))
