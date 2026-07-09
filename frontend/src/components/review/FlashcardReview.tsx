import { useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { RatingButtons } from './RatingButtons'
import { ReviewStats } from './ReviewStats'
import { useReviewStore } from '../../stores/reviewStore'

export function FlashcardReview() {
  const { queue, currentIndex, flipped, stats, isActive, flip, rate, nextCard, endReview } = useReviewStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); flip(); return }
      if (e.key === '1') { rate('again'); return }
      if (e.key === '2') { rate('hard'); return }
      if (e.key === '3') { rate('good'); return }
      if (e.key === '4') { rate('easy'); return }
      if (e.key === 'ArrowRight') { nextCard(); return }
      if (e.key === 'Escape') { endReview(); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [flip, rate, nextCard, endReview])

  if (!isActive || queue.length === 0) return null

  const isComplete = currentIndex >= queue.length
  const current = queue[currentIndex]

  return (
    <div className="fixed inset-0 z-modal bg-bg-primary flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <button onClick={endReview} className="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary cursor-pointer">
          <ArrowLeft size={16} /> Back to Workspace
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-tertiary">
            Card {Math.min(currentIndex + 1, queue.length)} of {queue.length}
          </span>
          <button onClick={endReview} aria-label="Close review" className="p-1.5 hover:bg-surface-hover rounded-none cursor-pointer">
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>
      </div>

      {isComplete ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold text-text-primary uppercase tracking-wider">Review Complete!</h2>
          <ReviewStats stats={stats} />
          <button onClick={endReview} className="px-6 py-2.5 bg-text-primary border border-text-primary text-text-inverse hover:bg-transparent hover:text-text-primary rounded-none font-semibold uppercase tracking-wider transition-colors cursor-pointer">
            Return to Workspace
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div
            onClick={flip}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') flip() }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? current.back : current.front}
            className="w-full max-w-xl aspect-[3/2] cursor-pointer perspective-[1000px]"
          >
            <div className={`relative w-full h-full transition-transform duration-500 ease-in-out ${flipped ? 'rotateY-180' : ''}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="absolute inset-0 bg-surface-card border border-border-default rounded-none shadow-md flex items-center justify-center p-8 backface-hidden">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Question</p>
                  <p className="text-xl font-medium text-text-primary leading-relaxed">{current.front}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-surface-card border border-border-default rounded-none shadow-md flex items-center justify-center p-8 backface-hidden rotateY-180">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Answer</p>
                  <p className="text-lg text-text-secondary leading-relaxed">{current.back}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-text-tertiary">Click card or press Space to flip · 1-4 to rate</p>

          {flipped && <RatingButtons onRate={rate} />}
        </div>
      )}
    </div>
  )
}
