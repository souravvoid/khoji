import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'
type View = 'library' | 'document' | 'settings'

interface UIState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  sidebarOpen: boolean
  chatOpen: boolean
  searchOpen: boolean
  settingsOpen: boolean
  currentView: View
  activeDocumentId: string | null
  activeTab: string
  setTheme: (theme: Theme) => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
  toggleChat: () => void
  setSearchOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setCurrentView: (view: View) => void
  setActiveDocumentId: (id: string | null) => void
  setActiveTab: (tab: string) => void
  initTheme: () => void
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
  // Also set class for Tailwind dark mode
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: (() => {
    try {
      return (localStorage.getItem('khoji-theme') as Theme) || 'system'
    } catch {
      return 'system'
    }
  })(),
  resolvedTheme: 'light',
  sidebarOpen: true,
  chatOpen: false,
  searchOpen: false,
  settingsOpen: false,
  currentView: 'library',
  activeDocumentId: null,
  activeTab: 'notes',

  setTheme: (theme) => {
    try { localStorage.setItem('khoji-theme', theme) } catch {}
    const resolved = resolveTheme(theme)
    applyTheme(resolved)
    set({ theme, resolvedTheme: resolved })
  },

  toggleDarkMode: () => {
    const current = get().resolvedTheme
    const newTheme = current === 'dark' ? 'light' : 'dark'
    const theme: Theme = newTheme
    try { localStorage.setItem('khoji-theme', theme) } catch {}
    applyTheme(newTheme)
    set({ theme, resolvedTheme: newTheme })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCurrentView: (view) => set({ currentView: view }),
  setActiveDocumentId: (id) => set({ activeDocumentId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  initTheme: () => {
    const { theme } = get()
    const resolved = resolveTheme(theme)
    applyTheme(resolved)
    set({ resolvedTheme: resolved })

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e: MediaQueryListEvent) => {
      if (get().theme === 'system') {
        const r = e.matches ? 'dark' : 'light'
        applyTheme(r)
        set({ resolvedTheme: r })
      }
    }
    mq.addEventListener('change', listener)
  },
}))
