import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variantStyles = {
  primary: 'bg-primary-500/10 text-text-primary border border-primary-500/20',
  secondary: 'bg-transparent border border-border-default text-text-secondary',
  success: 'bg-success-500/10 text-success-500 border border-success-500/20',
  warning: 'bg-warning-500/10 text-warning-500 border border-warning-500/20',
  error: 'bg-error-500/10 text-error-500 border border-error-500/20',
  neutral: 'bg-bg-tertiary text-text-tertiary border border-transparent',
}

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider',
  md: 'px-2.5 py-0.5 text-xs uppercase font-semibold tracking-wider',
}

export function Badge({ variant = 'neutral', size = 'sm', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-none font-sans ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  )
}
