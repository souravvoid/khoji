import { useState } from 'react'
import { Bot, User, Clipboard, Check } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant'
    content: string
    citations?: { page: number; text: string }[]
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { role, content, citations } = message
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex gap-3 px-4 py-3 border-b border-border-default/50 ${isUser ? '' : 'bg-bg-secondary/40'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-none flex items-center justify-center border
        ${isUser ? 'bg-bg-tertiary text-text-primary border-border-default' : 'bg-text-primary text-text-inverse border-text-primary'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
            {isUser ? 'You' : 'AI Assistant'}
          </p>
          {!isUser && content && (
            <button onClick={handleCopy} className="flex-shrink-0 p-1 hover:bg-surface-hover rounded-none text-text-tertiary hover:text-text-primary transition-colors cursor-pointer" aria-label="Copy response">
              {copied ? <Check size={12} className="text-success-500" /> : <Clipboard size={12} />}
            </button>
          )}
        </div>
        <div className="text-sm text-text-primary prose prose-sm max-w-none prose-p:text-text-secondary prose-strong:text-text-primary prose-a:text-primary-500">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
        {citations && citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citations.map((cit, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-none bg-bg-tertiary border border-border-default text-text-tertiary font-mono">
                Source: Page {cit.page}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
