interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-border-default border-t-primary-500 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
