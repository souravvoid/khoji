interface ReviewStatsProps {
  stats: {
    total: number
    reviewed: number
    again: number
    hard: number
    good: number
    easy: number
  }
}

export function ReviewStats({ stats }: ReviewStatsProps) {
  const retention = stats.reviewed > 0
    ? Math.round(((stats.good + stats.easy) / stats.reviewed) * 100)
    : 0

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-bg-secondary rounded-lg">
      <div className="text-center">
        <div className="text-2xl font-bold text-text-primary">{stats.reviewed}</div>
        <div className="text-xs text-text-tertiary">Reviewed</div>
      </div>
      <div className="w-px h-8 bg-border-default" />
      <div className="text-center">
        <div className="text-2xl font-bold text-success-500">{retention}%</div>
        <div className="text-xs text-text-tertiary">Retention</div>
      </div>
      <div className="w-px h-8 bg-border-default" />
      <div className="flex gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error-500" />{stats.again}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning-500" />{stats.hard}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success-500" />{stats.good}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary-500" />{stats.easy}</span>
      </div>
    </div>
  )
}
