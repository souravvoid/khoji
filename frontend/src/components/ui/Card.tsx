import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive'
  padding?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const paddingMap = { sm: 'p-3', md: 'p-4', lg: 'p-6' }

export function Card({ variant = 'default', padding = 'md', children, className = '', onClick, onKeyDown, ...props }: CardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (variant === 'interactive' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick?.(e as unknown as MouseEvent<HTMLDivElement>)
    }
    onKeyDown?.(e)
  }

  return (
    <div
      role={variant === 'interactive' ? 'button' : undefined}
      tabIndex={variant === 'interactive' ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`bg-surface-card border border-border-default rounded-none
        ${variant === 'interactive' ? 'hover:border-border-hover hover:bg-surface-hover cursor-pointer transition-all duration-normal ease-out' : ''}
        ${paddingMap[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
