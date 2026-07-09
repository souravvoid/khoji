interface RatingButtonsProps {
  onRate: (rating: 'again' | 'hard' | 'good' | 'easy') => void
}

const ratings = [
  { value: 'again' as const, label: 'Again', time: '1min', color: 'bg-error-500 hover:bg-error-600' },
  { value: 'hard' as const, label: 'Hard', time: '5min', color: 'bg-warning-500 hover:bg-warning-600' },
  { value: 'good' as const, label: 'Good', time: '1d', color: 'bg-success-500 hover:bg-success-600' },
  { value: 'easy' as const, label: 'Easy', time: '3d', color: 'bg-secondary-500 hover:bg-secondary-600' },
]

export function RatingButtons({ onRate }: RatingButtonsProps) {
  return (
    <div className="flex gap-2 w-full max-w-lg mx-auto">
      {ratings.map((r) => (
        <button
          key={r.value}
          onClick={() => onRate(r.value)}
          className={`flex-1 ${r.color} text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-fast ease-out cursor-pointer active:scale-95`}
        >
          <div>{r.label}</div>
          <div className="text-xs opacity-80 mt-0.5">{r.time}</div>
        </button>
      ))}
    </div>
  )
}
