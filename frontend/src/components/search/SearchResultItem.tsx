import { FileText } from 'lucide-react'

interface SearchResultItemProps {
  result: {
    id: string
    title: string
    snippet: string
    page?: number
    score: number
    docTitle?: string
  }
  onClick: () => void
}

export function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      data-testid="search-result-item"
      className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors border-b border-border-default last:border-b-0 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-primary-50 text-primary-600 flex-shrink-0 mt-0.5">
          <FileText size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-text-primary truncate">{result.title}</span>
            {result.docTitle && (
              <span className="text-xs text-text-tertiary truncate">in {result.docTitle}</span>
            )}
          </div>
          <p className="text-sm text-text-secondary line-clamp-2">{result.snippet}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {result.page && <span className="text-xs text-text-tertiary">Page {result.page}</span>}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 bg-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${result.score}%` }} />
              </div>
              <span className="text-xs text-text-tertiary">{Math.round(result.score)}%</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
