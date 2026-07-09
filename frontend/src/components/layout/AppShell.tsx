import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { SearchModal } from '../search/SearchModal'
import { SettingsDrawer } from '../settings/SettingsDrawer'
import { ProcessingModal } from '../processing/ProcessingModal'
import { useDocumentStore } from '../../stores/documentStore'

interface AppShellProps {
  children: ReactNode
  onUpload: () => void
}

export function AppShell({ children, onUpload }: AppShellProps) {
  const processingQueue = useDocumentStore((s) => s.processingQueue)

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface-modal focus:text-text-primary focus:rounded-none focus:border focus:border-border-default focus:text-sm">
        Skip to content
      </a>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onUpload={onUpload} />
          <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
            {children}
          </main>
          <StatusBar />
        </div>
      </div>
      <SearchModal />
      <SettingsDrawer />
      {processingQueue.length > 0 && <ProcessingModal />}
    </div>
  )
}
