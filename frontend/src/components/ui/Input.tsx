import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  error?: string
  clearable?: boolean
  onClear?: () => void
  rightElement?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, clearable, onClear, rightElement, className = '', ...props }, ref) => (
    <div className="relative w-full">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        className={`w-full bg-bg-primary border text-sm text-text-primary placeholder-text-tertiary rounded-none
          transition-all duration-fast ease-out
          focus:outline-none focus:border-text-primary
          ${icon ? 'pl-10' : 'pl-3'} ${rightElement || clearable ? 'pr-10' : 'pr-3'} py-2
          ${error ? 'border-error-500 focus:border-error-500' : 'border-border-default hover:border-border-hover'}
          ${className}`}
        {...props}
      />
      {(clearable || rightElement) && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {rightElement}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-error-500">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
