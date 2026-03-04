/**
 * Keyboard shortcut definitions and remappable actions (spec §5).
 * Used by ShortcutSheet and Settings remapping.
 */

export interface RemappableAction {
  id: string
  label: string
  defaultKeys: string
}

const modLabel = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')
  ? 'Cmd'
  : 'Ctrl'

/** Actions that can be remapped in Settings. Spec §5. */
export const REMAPPABLE_ACTIONS: RemappableAction[] = [
  { id: 'view.main', label: 'Main view', defaultKeys: `${modLabel}+1` },
  { id: 'view.upcoming', label: 'Upcoming view', defaultKeys: `${modLabel}+Shift+L` },
  { id: 'view.archive', label: 'Archive view', defaultKeys: `${modLabel}+Shift+A` },
  { id: 'command.palette', label: 'Open command palette', defaultKeys: `${modLabel}+K` },
  { id: 'search.open', label: 'Open search overlay', defaultKeys: `${modLabel}+Shift+S` },
  { id: 'view.completedToggle', label: 'Show/hide completed tasks', defaultKeys: `${modLabel}+Shift+H` },
  { id: 'view.shortcutSheet', label: 'Show keyboard shortcuts', defaultKeys: `${modLabel}+/` },
  { id: 'settings.open', label: 'Open settings', defaultKeys: `${modLabel}+,` },
  { id: 'action.undo', label: 'Undo', defaultKeys: `${modLabel}+Z` },
  { id: 'action.redo', label: 'Redo', defaultKeys: `${modLabel}+Shift+Z` },
  { id: 'edit.full', label: 'Full edit (panel)', defaultKeys: `${modLabel}+Shift+E` },
  { id: 'task.delete', label: 'Delete selected', defaultKeys: `${modLabel}+Delete` },
  { id: 'clipboard.copy', label: 'Copy', defaultKeys: `${modLabel}+C` },
  { id: 'clipboard.cut', label: 'Cut', defaultKeys: `${modLabel}+X` },
  { id: 'clipboard.paste', label: 'Paste', defaultKeys: `${modLabel}+V` },
  { id: 'clipboard.copyRecursive', label: 'Copy recursive', defaultKeys: `${modLabel}+Shift+C` },
  { id: 'select.all', label: 'Select all in column', defaultKeys: `${modLabel}+A` },
  { id: 'color.none', label: 'Color: none', defaultKeys: `${modLabel}+Alt+N` },
  { id: 'color.category', label: 'Color: category', defaultKeys: `${modLabel}+Alt+C` },
  { id: 'color.priority', label: 'Color: priority', defaultKeys: `${modLabel}+Alt+P` },
]

/** Full list for Shortcut sheet (spec §5). */
export const SHORTCUT_SHEET_ENTRIES: { keys: string; label: string }[] = [
  { keys: `${modLabel}+1`, label: 'Main view' },
  { keys: `${modLabel}+Shift+L`, label: 'Upcoming view' },
  { keys: `${modLabel}+Shift+A`, label: 'Archive view' },
  { keys: `${modLabel}+K`, label: 'Open command palette' },
  { keys: '\\', label: 'Open command palette (in list/editor)' },
  { keys: `${modLabel}+Shift+S`, label: 'Open search' },
  { keys: `${modLabel}+/`, label: 'Show keyboard shortcuts' },
  { keys: `${modLabel}+,`, label: 'Open settings' },
  { keys: `${modLabel}+Shift+H`, label: 'Show/hide completed tasks' },
  { keys: `${modLabel}+Z`, label: 'Undo' },
  { keys: `${modLabel}+Shift+Z`, label: 'Redo' },
  { keys: `${modLabel}+Shift+←`, label: 'Scroll column left' },
  { keys: `${modLabel}+Shift+→`, label: 'Scroll column right' },
  { keys: 'Home', label: 'First column' },
  { keys: 'End', label: 'Last column' },
  { keys: `${modLabel}+Alt+N`, label: 'Color: none' },
  { keys: `${modLabel}+Alt+C`, label: 'Color: category' },
  { keys: `${modLabel}+Alt+P`, label: 'Color: priority' },
  { keys: '↑ / ↓', label: 'Move focus up / down' },
  { keys: '←', label: 'Collapse column' },
  { keys: '→ / Enter', label: 'Expand / open' },
  { keys: 'Space', label: 'Toggle completion' },
  { keys: 'Shift+↑ / ↓', label: 'Extend selection' },
  { keys: `${modLabel}+A`, label: 'Select all in column' },
  { keys: `${modLabel}+↑ / ↓`, label: 'First / last item in column' },
  { keys: `${modLabel}+Shift+E`, label: 'Full edit (panel)' },
  { keys: `${modLabel}+Delete`, label: 'Delete selected' },
  { keys: `${modLabel}+C`, label: 'Copy' },
  { keys: `${modLabel}+Shift+C`, label: 'Copy recursive' },
  { keys: `${modLabel}+X`, label: 'Cut' },
  { keys: `${modLabel}+V`, label: 'Paste' },
  { keys: 'Ctrl+Space then G', label: 'Grab mode (move with arrows, Enter to drop)' },
  { keys: 'Escape', label: 'Close / cancel' },
]

/** Serialize a keyboard event to a normalized combo string for comparison and storage. */
export function keyEventToCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push(modLabel)
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  parts.push(key)
  return parts.join('+')
}

/** Return action id that is remapped to this combo, or null. */
export function getActionIdForCombo(
  combo: string,
  customShortcuts: Record<string, string>
): string | null {
  for (const [actionId, keyCombo] of Object.entries(customShortcuts)) {
    if (keyCombo === combo) return actionId
  }
  return null
}
