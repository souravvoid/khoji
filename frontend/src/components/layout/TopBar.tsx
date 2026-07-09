import { Search, Upload, Sparkles } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { useUIStore } from '../../stores/uiStore'

interface TopBarProps {
  onUpload: () => void
}

export function TopBar({ onUpload }: TopBarProps) {
  const { setSearchOpen } = useUIStore()

  return (
    <header className="h-14 border-b border-border-default bg-bg-primary flex items-center px-4 gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-none bg-text-primary flex items-center justify-center flex-shrink-0 lg:hidden">
          <Sparkles size={14} className="text-text-inverse" />
        </div>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        data-testid="topbar-search"
        className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border border-border-default rounded-none
          text-sm text-text-tertiary hover:border-border-hover hover:text-text-secondary transition-colors
          w-64 cursor-pointer"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search documents...</span>
        <kbd className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded-none text-text-tertiary font-mono">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <IconButton icon={<Upload size={18} />} label="Upload document" onClick={onUpload} data-testid="topbar-upload" />
      </div>
    </header>
  )
}
