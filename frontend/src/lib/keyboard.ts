export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

export function modKey(): '⌘' | 'Ctrl' {
  return isMac() ? '⌘' : 'Ctrl'
}

export function formatShortcut(shortcut: { key: string; mod?: boolean; shift?: boolean; ctrl?: boolean }): string {
  const parts: string[] = []
  if (isMac()) {
    if (shortcut.mod) parts.push('⌘')
    if (shortcut.shift) parts.push('⇧')
    if (shortcut.ctrl) parts.push('^')
  } else {
    if (shortcut.mod) parts.push('Ctrl')
    if (shortcut.shift) parts.push('Shift')
  }
  parts.push(shortcut.key.toUpperCase())
  return parts.join('+')
}
