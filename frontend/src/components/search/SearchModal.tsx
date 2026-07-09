import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { SearchResultItem } from './SearchResultItem'
import { useUIStore } from '../../stores/uiStore'
import { useDocumentStore } from '../../stores/documentStore'
import { searchDocuments } from '../../lib/ipc'
import { SEARCH_FOCUS_DELAY_MS, SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH, SEARCH_SNIPPET_LENGTH } from '../../lib/constants'

interface SearchResult {
  chunk_id: string
  doc_id: string
  score: number
  content: string
  page_number: number
  doc_title: string
}

export function SearchModal() {
  const { searchOpen, setSearchOpen, setCurrentView, setActiveDocumentId } = useUIStore()
  const { documents, setActiveDocument } = useDocumentStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), SEARCH_FOCUS_DELAY_MS)
    } else {
      setQuery('')
      setResults([])
      setSearched(false)
    }
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen, setSearchOpen])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < SEARCH_MIN_QUERY_LENGTH) {
      setResults([])
      setSearchError('')
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)
    setSearchError('')

      debounceRef.current = setTimeout(async () => {
        try {
          const hits = await searchDocuments(query)
        setResults(Array.isArray(hits) ? hits : [])
      } catch {
        setResults([])
        setSearchError('Search failed — check that the engine is running')
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleOpenResult = async (result: SearchResult) => {
    const doc = documents.find((d) => d.id === result.doc_id)
    if (doc) {
      setActiveDocument(doc)
      setActiveDocumentId(result.doc_id)
      setCurrentView('document')
      setSearchOpen(false)
    }
  }

  if (!searchOpen) return null

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh]" data-testid="search-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" role="presentation" onClick={() => setSearchOpen(false)} onKeyDown={() => {}} />
      <div className="relative w-full max-w-2xl bg-surface-modal rounded-none border border-border-default shadow-2xl animate-[scaleIn_200ms_ease-out] max-h-[60vh] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inside all documents..."
            data-testid="search-input"
            className="flex-1 bg-transparent text-base text-text-primary placeholder-text-tertiary outline-none"
          />
          <kbd className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded-none text-text-tertiary font-mono">ESC</kbd>
          <button onClick={() => setSearchOpen(false)} aria-label="Close search" className="p-1 hover:bg-surface-hover rounded-none cursor-pointer">
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin flex-1" data-testid="search-results">
          {query === '' ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              Start typing to search across all documents
            </div>
          ) : loading ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Searching...</span>
            </div>
          ) : !searched ? null : searchError ? (
            <div className="px-4 py-8 text-center text-sm text-status-error">
              {searchError}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              No results found for "{query}"
            </div>
          ) : (
            results.map((r) => (
              <SearchResultItem
                key={r.chunk_id}
                result={{
                  id: r.doc_id,
                  title: r.doc_title || 'Untitled',
                  snippet: r.content?.slice(0, SEARCH_SNIPPET_LENGTH) || '',
                  page: r.page_number || undefined,
                  score: Math.round((r.score || 0) * 100),
                  docTitle: r.doc_title,
                }}
                onClick={() => handleOpenResult(r)}
              />
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border-default flex items-center gap-4 text-xs text-text-tertiary">
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded-none font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded-none font-mono">↵</kbd> Open</span>
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded-none font-mono">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
