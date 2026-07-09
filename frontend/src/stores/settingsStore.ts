import { create } from 'zustand'

interface ModelInfo {
  id: string
  name: string
  type: 'ocr' | 'embedding' | 'llm'
  size: string
  status: 'downloaded' | 'downloading' | 'not-installed'
  ram_mb: number
  quality: number
  selected: boolean
  progress?: number
}

interface SettingsState {
  modelSearchOpen: boolean
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  readingMode: boolean
  autoExport: boolean
  startUp: 'library' | 'last-document'
  models: ModelInfo[]
  setModelSearchOpen: (open: boolean) => void
  setFontSize: (size: 'sm' | 'md' | 'lg' | 'xl') => void
  setReadingMode: (mode: boolean) => void
  setAutoExport: (export_: boolean) => void
  setStartUp: (startUp: 'library' | 'last-document') => void
  setModels: (models: ModelInfo[]) => void
  updateModel: (id: string, updates: Partial<ModelInfo>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  modelSearchOpen: false,
  fontSize: 'md',
  readingMode: false,
  autoExport: false,
  startUp: 'library',
  models: [],

  setModelSearchOpen: (open) => set({ modelSearchOpen: open }),
  setFontSize: (fontSize) => set({ fontSize }),
  setReadingMode: (readingMode) => set({ readingMode }),
  setAutoExport: (autoExport) => set({ autoExport }),
  setStartUp: (startUp) => set({ startUp }),
  setModels: (models) => set({ models }),
  updateModel: (id, updates) => set((s) => ({
    models: s.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  })),
}))
