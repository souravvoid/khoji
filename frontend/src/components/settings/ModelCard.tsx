import { Check, Download, HardDrive, Cpu } from 'lucide-react'
import { Button } from '../ui/Button'

interface ModelCardProps {
  model: {
    id: string
    name: string
    type: string
    size: string
    status: 'downloaded' | 'downloading' | 'not-installed'
    ram_mb: number
    quality: number
    selected: boolean
    progress?: number
  }
  onDownload: () => void
  onSelect: () => void
}

export function ModelCard({ model, onDownload, onSelect }: ModelCardProps) {
  return (
    <div className={`p-3 rounded-none border transition-all ${
      model.selected
        ? 'border-l-2 border-l-primary-500 bg-surface-active border-border-default'
        : 'border-border-default hover:border-border-hover border-l-transparent'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text-primary">{model.name}</h4>
            {model.selected && <Check size={14} className="text-text-primary font-bold" />}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-tertiary">
            <span className="flex items-center gap-1 font-mono">
              <HardDrive size={12} /> {model.size}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Cpu size={12} /> {model.ram_mb}MB RAM
            </span>
            <span className="text-amber-500">{'★'.repeat(model.quality)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {model.status === 'downloaded' ? (
            <Button size="sm" variant={model.selected ? 'primary' : 'secondary'} onClick={onSelect}>
              {model.selected ? 'Active' : 'Select'}
            </Button>
          ) : model.status === 'downloading' ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-bg-tertiary rounded-none overflow-hidden">
                <div className="h-full m-stripe rounded-none" style={{ width: `${model.progress || 0}%` }} />
              </div>
              <span className="text-xs text-text-tertiary font-mono">{model.progress}%</span>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={onDownload}>
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
