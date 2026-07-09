import { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

interface ShortcutMap {
  [key: string]: () => void
}

export function useKeyboard(shortcuts?: ShortcutMap) {
  const {
    toggleSidebar, toggleChat, setSearchOpen, setSettingsOpen,
    toggleDarkMode, setCurrentView,
  } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Global shortcuts
      if (mod && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
        return
      }
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }
      if (mod && e.key === 'd') {
        e.preventDefault()
        toggleDarkMode()
        return
      }
      if (mod && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        toggleChat()
        return
      }
      if (mod && e.key === '1') {
        e.preventDefault()
        setCurrentView('library')
        return
      }

      // Custom shortcuts passed by caller
      if (shortcuts && shortcuts[e.key]) {
        shortcuts[e.key]()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts, toggleSidebar, toggleChat, setSearchOpen, setSettingsOpen, toggleDarkMode, setCurrentView])
}
