import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const variantStyles = {
  primary: 'bg-text-primary border border-text-primary text-text-inverse hover:bg-transparent hover:text-text-primary active:bg-surface-active shadow-sm font-semibold uppercase tracking-wider',
  secondary: 'bg-transparent border border-border-default text-text-primary hover:bg-surface-hover hover:border-border-hover active:bg-surface-active font-semibold uppercase tracking-wider',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary active:bg-surface-active font-semibold uppercase tracking-wider',
  danger: 'bg-error-500 border border-error-500 text-white hover:bg-transparent hover:text-error-500 active:bg-error-500/10 font-semibold uppercase tracking-wider',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
  xl: 'px-6 py-3 text-lg gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, loading, fullWidth, children, disabled, className = '', ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-none transition-all duration-fast ease-out
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} /> : icon}
      {children && <span>{children}</span>}
    </button>
  )
)
Button.displayName = 'Button'
