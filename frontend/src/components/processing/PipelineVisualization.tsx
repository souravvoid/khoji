import { Check, Loader2, X } from 'lucide-react'

interface Stage {
  id: string
  label: string
  status: 'completed' | 'active' | 'pending' | 'error'
}

interface PipelineVisualizationProps {
  stages: Stage[]
}

const stageIcons: Record<string, React.ReactNode> = {
  completed: <Check size={16} className="text-success-500" />,
  active: <Loader2 size={16} className="text-primary-500 animate-spin" />,
  pending: null,
  error: <X size={16} className="text-error-500" />,
}

export function PipelineVisualization({ stages }: PipelineVisualizationProps) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-1 flex-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all
            ${stage.status === 'completed' ? 'bg-success-50 text-success-600' :
              stage.status === 'active' ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-500/30' :
              stage.status === 'error' ? 'bg-error-50 text-error-600' :
              'bg-bg-tertiary text-text-tertiary'}`}
          >
            {stageIcons[stage.status] || (
              <span className="text-xs">{i + 1}</span>
            )}
          </div>
          <span className={`text-xs truncate max-w-[80px] ${
            stage.status === 'active' ? 'text-primary-600 font-medium' :
            stage.status === 'completed' ? 'text-success-600' :
            stage.status === 'error' ? 'text-error-600' :
            'text-text-tertiary'
          }`}>
            {stage.label}
          </span>
          {i < stages.length - 1 && (
            <div className={`flex-1 h-px mx-1 ${
              stage.status === 'completed' ? 'bg-success-500' :
              stage.status === 'active' ? 'bg-primary-300' :
              'bg-border-default'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
