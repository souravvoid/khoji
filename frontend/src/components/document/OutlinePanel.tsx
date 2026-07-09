interface Section {
  id: string
  title: string
  level: number
}

interface OutlinePanelProps {
  sections: Section[]
  activeSection: string | null
  onSectionClick: (id: string) => void
}

export function OutlinePanel({ sections, activeSection, onSectionClick }: OutlinePanelProps) {
  if (sections.length === 0) return null

  return (
    <div className="w-56 bg-bg-secondary border-r border-border-default overflow-y-auto scrollbar-thin p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 px-2">Outline</h3>
      <div className="space-y-0.5">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={`w-full text-left px-2 py-1.5 text-sm rounded-none transition-colors cursor-pointer
              ${activeSection === section.id
                ? 'bg-surface-active text-text-primary font-bold'
                : 'text-text-secondary hover:bg-surface-hover'
              }`}
            style={{ paddingLeft: `${12 + (section.level - 1) * 12}px` }}
          >
            {section.title}
          </button>
        ))}
      </div>
    </div>
  )
}
