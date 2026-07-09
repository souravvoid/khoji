import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary'
}

const sizeMap = { sm: 'w-8 h-8 p-1.5', md: 'w-9 h-9 p-2', lg: 'w-10 h-10 p-2.5' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = 'md', variant = 'ghost', className = '', ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-fast ease-out
        ${variant === 'ghost' ? 'text-text-secondary hover:bg-surface-hover hover:text-text-primary active:bg-surface-active' : 'text-text-primary border border-border-default hover:bg-surface-hover active:bg-surface-active'}
        ${sizeMap[size]}
        ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
)
IconButton.displayName = 'IconButton'
