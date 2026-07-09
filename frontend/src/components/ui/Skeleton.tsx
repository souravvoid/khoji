interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle'
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({ variant = 'text', width, height, className = '' }: SkeletonProps) {
  const base = 'animate-pulse bg-bg-tertiary rounded-none'
  if (variant === 'circle') {
    return <div className={`${base} rounded-full ${className}`} style={{ width: width ?? 40, height: height ?? 40 }} />
  }
  if (variant === 'card') {
    return <div className={`${base} ${className}`} style={{ width, height: height ?? 200 }} />
  }
  return <div className={`${base} h-4 ${className}`} style={{ width: width ?? '100%' }} />
}
