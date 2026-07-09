import { type ReactNode } from 'react'

interface Tab {
  value: string
  label: string
  icon?: ReactNode
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  value: string
  onChange: (value: string) => void
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 border-b border-border-default">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          data-testid={`tab-${tab.value}`}
          className={`relative flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-fast ease-out cursor-pointer
            ${value === tab.value
              ? 'text-text-primary font-bold'
              : 'text-text-tertiary hover:text-text-secondary'
            }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-none font-mono
              ${value === tab.value ? 'bg-text-primary text-text-inverse' : 'bg-bg-tertiary text-text-tertiary'}`}>
              {tab.count}
            </span>
          )}
          {value === tab.value && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] m-stripe" />
          )}
        </button>
      ))}
    </div>
  )
}
