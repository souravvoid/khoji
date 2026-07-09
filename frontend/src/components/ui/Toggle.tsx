interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <div
        className={`relative w-9 h-5 rounded-none border transition-colors duration-fast ease-out
          ${checked ? 'bg-text-primary border-text-primary' : 'bg-bg-tertiary border-border-default'}`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-none transition-transform duration-fast ease-out
            ${checked ? 'translate-x-4 bg-text-inverse' : 'translate-x-0 bg-text-primary'}`}
        />
      </div>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="text-sm text-text-primary font-medium">{label}</span>}
    </label>
  )
}
