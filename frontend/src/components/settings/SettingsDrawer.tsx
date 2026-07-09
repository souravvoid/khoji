import { useState } from 'react'
import { X, Settings, Cpu, Monitor, Keyboard, Accessibility } from 'lucide-react'
import { Toggle } from '../ui/Toggle'
import { ModelManager } from './ModelManager'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
]

export function SettingsDrawer() {
  const { settingsOpen, setSettingsOpen, theme, setTheme } = useUIStore()
  const { fontSize, setFontSize, readingMode, setReadingMode } = useSettingsStore()
  const [activeSection, setActiveSection] = useState('general')

  if (!settingsOpen) return null

  const ThemeToggle = () => (
    <div className="flex gap-1 p-1 bg-bg-tertiary rounded-none border border-border-default">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          data-testid={`theme-${t}`}
          className={`px-3 py-1.5 text-sm rounded-none capitalize transition-all cursor-pointer ${
            theme === t
              ? 'bg-text-primary text-text-inverse font-bold'
              : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-modal flex justify-end" data-testid="settings-drawer">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" role="presentation" onClick={() => setSettingsOpen(false)} onKeyDown={() => {}} />
      <div className="relative w-[560px] max-w-full bg-surface-modal h-full border-l border-border-default shadow-2xl animate-[slideIn_200ms_ease-out] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          </div>
          <button onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="p-1.5 hover:bg-surface-hover rounded-none cursor-pointer">
            <X size={18} className="text-text-tertiary" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-44 bg-bg-secondary border-r border-border-default p-3 space-y-1">
            {SETTINGS_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                data-testid={`settings-section-${s.id}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-none border-l-2 transition-colors cursor-pointer ${
                  activeSection === s.id
                    ? 'border-l-primary-500 bg-surface-active text-text-primary font-bold'
                    : 'border-l-transparent text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <s.icon size={16} />
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Theme</h3>
                  <ThemeToggle />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Font Size</h3>
                  <div className="flex gap-1 p-1 bg-bg-tertiary rounded-none border border-border-default w-fit">
                    {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
                       <button
                        key={s}
                        onClick={() => setFontSize(s)}
                        data-testid={`font-size-${s}`}
                        className={`px-3 py-1.5 text-sm rounded-none capitalize transition-all cursor-pointer ${
                          fontSize === s
                            ? 'bg-text-primary text-text-inverse font-bold'
                            : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                      >
                        {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : s === 'lg' ? 'Large' : 'XL'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Reading Mode</h3>
                    <p className="text-xs text-text-tertiary">Use serif font for reading</p>
                  </div>
                  <Toggle checked={readingMode} onChange={setReadingMode} />
                </div>
              </div>
            )}

            {activeSection === 'models' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-4">AI Models</h3>
                <p className="text-xs text-text-tertiary mb-4">
                  Download and manage AI models. All processing runs locally on your device.
                </p>
                <ModelManager />
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Theme</h3>
                  <ThemeToggle />
                </div>
              </div>
            )}

            {activeSection === 'shortcuts' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Keyboard Shortcuts</h3>
                {[
                  { keys: '⌘K', desc: 'Quick search' },
                  { keys: '⌘,', desc: 'Settings' },
                  { keys: '⌘B', desc: 'Toggle sidebar' },
                  { keys: '⌘D', desc: 'Toggle dark mode' },
                  { keys: '⌘1', desc: 'Library' },
                  { keys: 'Space', desc: 'Show answer (flashcards)' },
                  { keys: '1-4', desc: 'Rate card (flashcards)' },
                  { keys: 'A-D', desc: 'Select quiz option' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-text-primary">{s.desc}</span>
                    <kbd className="text-xs px-2 py-0.5 bg-bg-tertiary rounded-none text-text-tertiary font-mono">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'accessibility' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Accessibility</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm text-text-primary">High Contrast</h3>
                    <p className="text-xs text-text-tertiary">Increase contrast for better readability</p>
                  </div>
                  <Toggle checked={false} onChange={() => {}} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm text-text-primary">Reduced Motion</h3>
                    <p className="text-xs text-text-tertiary">Minimize animations</p>
                  </div>
                  <Toggle checked={false} onChange={() => {}} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
