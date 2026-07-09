import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: ReactNode
  closeOnOverlayClick?: boolean
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export function Modal({ open, onClose, title, size = 'md', children, closeOnOverlayClick = true }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        className={`relative w-full ${sizeMap[size]} bg-surface-modal rounded-none border border-border-default shadow-2xl
          animate-[scaleIn_200ms_ease-out] max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <IconButton icon={<X size={18} />} label="Close" onClick={onClose} />
          </div>
        )}
        <div className="overflow-y-auto scrollbar-thin">{children}</div>
      </div>
    </div>
  )
}
