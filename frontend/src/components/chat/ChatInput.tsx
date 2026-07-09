import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything about this document...' }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  const handleSend = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-border-default bg-bg-primary">
      <div className="flex items-end gap-2 bg-bg-secondary border border-border-default rounded-none px-3 py-2 focus-within:border-text-primary transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary resize-none outline-none max-h-[120px]"
        />
        {value.trim() ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            aria-label="Send message"
            className="p-1.5 rounded-none bg-text-primary text-text-inverse hover:bg-transparent hover:text-text-primary border border-text-primary transition-all flex-shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        ) : (
          <Sparkles size={14} className="text-text-tertiary flex-shrink-0" />
        )}
      </div>
      <p className="mt-1 text-xs text-text-tertiary px-1">
        Use / for commands · Shift+Enter for new line
      </p>
    </div>
  )
}
