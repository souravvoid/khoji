interface ProgressBarProps {
  value: number
  variant?: 'primary' | 'success' | 'warning'
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

const variantColors = {
  primary: 'm-stripe',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
}

export function ProgressBar({ value, variant = 'primary', size = 'md', showLabel, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-bg-tertiary rounded-none overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`h-full rounded-none transition-all duration-slow ease-out ${variantColors[variant]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-text-tertiary font-mono w-10 text-right">{Math.round(clamped)}%</span>}
    </div>
  )
}
