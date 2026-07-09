import { useState, useRef, useEffect, cloneElement, type ReactNode, type ReactElement, type KeyboardEvent, type MouseEvent } from 'react'

interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
  shortcut?: string
  disabled?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
}

export function Dropdown({ trigger, items, align = 'left' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    setOpen((o) => !o)
  }

  const handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      setOpen((o) => !o)
    }
  }

  const triggerEl = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    onClick: toggle,
    onKeyDown: handleTriggerKeyDown,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    type: 'button',
  })

  return (
    <div ref={ref} className="relative">
      {triggerEl}
      {open && (
        <div
          role="menu"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
          className={`absolute top-full mt-1 min-w-[180px] bg-surface-modal border border-border-default rounded-none shadow-xl
            animate-[fadeIn_150ms_ease-out] z-dropdown ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="py-1">
            {items.map((item, i) => (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => { e.stopPropagation(); item.onClick(); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                  ${item.variant === 'danger' ? 'text-error-500 hover:bg-error-500/10' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary active:bg-surface-active'}
                  ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && <span className="text-xs text-text-tertiary font-mono">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
