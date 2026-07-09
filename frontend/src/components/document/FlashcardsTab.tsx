import { useEffect, useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { FlashcardReview } from '../review/FlashcardReview'
import { useReviewStore } from '../../stores/reviewStore'
import { useDocumentStore } from '../../stores/documentStore'
import { getDocument, type Flashcard } from '../../lib/ipc'

export function FlashcardsTab() {
  const { startReview, isActive } = useReviewStore()
  const { activeDocument } = useDocumentStore()
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!activeDocument) return
    setLoading(true)
    setFetchError('')
    getDocument(activeDocument.id)
      .then((data) => {
        if (data?.flashcards) {
          setCards(data.flashcards)
        } else {
          setCards([])
        }
      })
      .catch(() => {
        setCards([])
        setFetchError('Failed to load flashcards')
      })
      .finally(() => setLoading(false))
  }, [activeDocument?.id])

  if (isActive) return <FlashcardReview />

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Flashcards</h3>
          <p className="text-xs text-text-tertiary">{cards.length} cards generated</p>
        </div>
        <Button icon={<Play size={16} />} onClick={() => startReview(cards)} disabled={cards.length === 0}>
          Start Review
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      ) : fetchError ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-status-error">{fetchError}</p>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>}
          title="No flashcards yet"
          description="Flashcards will be automatically generated when you process a document."
        />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 grid gap-3">
          {cards.map((card: Flashcard, i: number) => (
            <div key={card.id || i} className="p-4 bg-surface-card border border-border-default rounded-lg hover:border-primary-200 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-xs font-medium text-primary-500 mt-0.5 w-5">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary mb-1">{card.front}</p>
                  <p className="text-sm text-text-secondary">{card.back}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
