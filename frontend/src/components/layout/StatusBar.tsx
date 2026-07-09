import { Cpu, HardDrive } from 'lucide-react'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'

export function StatusBar() {
  const documentsCount = useDocumentStore((s) => s.documents.length)
  const models = useSettingsStore((s) => s.models)
  const activeModel = models.find((m) => m.type === 'llm' && m.selected)
  const modelName = activeModel?.name || 'No model loaded'

  return (
    <footer className="h-7 bg-bg-secondary border-t border-border-default flex items-center px-4 gap-4 text-xs text-text-tertiary">
      <div className="flex items-center gap-1.5">
        <Cpu size={12} />
        <span>CPU</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
        <span>Model: {modelName}</span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <HardDrive size={12} />
        <span>{documentsCount} {documentsCount === 1 ? 'document' : 'documents'}</span>
      </div>
    </footer>
  )
}
