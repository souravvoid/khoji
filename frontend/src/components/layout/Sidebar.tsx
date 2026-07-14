import { useState, useCallback } from 'react'
import {
  Library, Layers, HelpCircle, GitBranch, MessageSquare,
  Search, Settings, ChevronLeft, ChevronRight, Clock, Sparkles
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

type NavItem = {
  icon: typeof Library;
  label: string;
  shortcut?: string;
} & ({ view: 'library'; action?: never } | { action: 'search' | 'settings'; view?: never })

type NavSection = {
  section: string;
  items: NavItem[];
}

const navItems: NavSection[] = [
  { section: 'Library', items: [
    { icon: Library, label: 'Documents', shortcut: '⌘1', view: 'library' },
  ]},
  { section: 'Learn', items: [
    { icon: Layers, label: 'Flashcards', view: 'library' },
    { icon: HelpCircle, label: 'Quiz', view: 'library' },
    { icon: GitBranch, label: 'Mind Maps', view: 'library' },
    { icon: Clock, label: 'Timeline', view: 'library' },
  ]},
  { section: 'Tools', items: [
    { icon: MessageSquare, label: 'Chat', view: 'library' },
    { icon: Search, label: 'Search', shortcut: '⌘K', action: 'search' },
    { icon: Settings, label: 'Settings', shortcut: '⌘,', action: 'settings' },
  ]},
]

const STUB_LABELS = new Set(['Flashcards', 'Quiz', 'Mind Maps', 'Timeline', 'Chat'])

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, setCurrentView, setSearchOpen, setSettingsOpen } = useUIStore()
  const [hint, setHint] = useState('')

  const showHint = useCallback((label: string) => {
    setHint(`Select a document to use ${label}`)
    setTimeout(() => setHint(''), 2500)
  }, [])

  return (
    <aside
      className={`bg-bg-secondary border-r border-border-default flex flex-col transition-all duration-normal ease-in-out overflow-hidden
        ${sidebarOpen ? 'w-[260px]' : 'w-[56px]'}`}
    >
      <div className="h-[3px] w-full m-stripe flex-shrink-0" />
      <div className="flex items-center h-14 px-4 border-b border-border-default gap-3">
        {sidebarOpen && (
          <>
            <div className="w-7 h-7 rounded-none bg-text-primary flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-text-inverse" />
            </div>
            <span className="font-bold text-text-primary text-sm uppercase tracking-wider">Khoji</span>
          </>
        )}
        <button
          onClick={toggleSidebar}
          className={`ml-auto p-1.5 rounded-none text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer ${!sidebarOpen ? 'mx-auto' : ''}`}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        {navItems.map((section, i) => (
          <div key={i} className="mb-2">
            {sidebarOpen && (
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {section.section}
              </p>
            )}
            {section.items.map((item, j) => (
              <button
                key={j}
                onClick={() => {
                  if (item.action === 'search') { setSearchOpen(true); return }
                  if (item.action === 'settings') { setSettingsOpen(true); return }
                  if (STUB_LABELS.has(item.label)) { showHint(item.label); return }
                  setCurrentView('library')
                }}
                className={`w-[calc(100%-16px)] flex items-center gap-3 px-3 py-2 mx-2 my-0.5 rounded-none text-sm
                  text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer
                  ${!sidebarOpen ? 'justify-center mx-0 px-0 w-full' : ''}`}
                aria-label={item.label}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && <span className="text-xs text-text-tertiary">{item.shortcut}</span>}
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="px-4 py-3 border-t border-border-default">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <div className="w-2 h-2 rounded-full bg-success-500" />
            <span>{hint || 'All systems ready'}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
