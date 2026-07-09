import { create } from 'zustand'

interface Flashcard {
  id: string
  front: string
  back: string
  card_type: string
  difficulty?: number
  tags?: string[]
}

interface ReviewStats {
  total: number
  reviewed: number
  again: number
  hard: number
  good: number
  easy: number
}

interface ReviewState {
  queue: Flashcard[]
  currentIndex: number
  flipped: boolean
  isActive: boolean
  stats: ReviewStats
  startReview: (cards: Flashcard[]) => void
  flip: () => void
  rate: (rating: 'again' | 'hard' | 'good' | 'easy') => void
  nextCard: () => void
  endReview: () => void
}

export const useReviewStore = create<ReviewState>((set) => ({
  queue: [],
  currentIndex: 0,
  flipped: false,
  isActive: false,
  stats: { total: 0, reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },

  startReview: (cards) => set({
    queue: cards,
    currentIndex: 0,
    flipped: false,
    isActive: true,
    stats: { total: cards.length, reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
  }),

  flip: () => set((s) => ({ flipped: !s.flipped })),

  rate: (rating) => set((s) => {
    const newStats = { ...s.stats, reviewed: s.stats.reviewed + 1 }
    newStats[rating]++
    return { stats: newStats, flipped: false, currentIndex: s.currentIndex + 1 }
  }),

  nextCard: () => set((s) => ({
    flipped: false,
    currentIndex: Math.min(s.currentIndex + 1, s.queue.length),
  })),

  endReview: () => set({ isActive: false, queue: [], currentIndex: 0, flipped: false }),
}))
