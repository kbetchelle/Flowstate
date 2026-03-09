/**
 * Help sheet: getting started / help content. Open from header Help.
 * Phase 12.
 */

import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

export function HelpSheet({ onClose }: { onClose: () => void }) {
  const setHelpSheetOpen = useAppStore((s) => s.setHelpSheetOpen)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setHelpSheetOpen(false)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setHelpSheetOpen, onClose])

  return (
    <div
      role="dialog"
      aria-label="Help"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setHelpSheetOpen(false)
          onClose()
        }
      }}
    >
      <div
        className="glass-surface"
        style={{
          padding: 24,
          maxWidth: 520,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Help</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
          <strong>Command palette</strong> — Press Cmd+K (or Ctrl+K) or type <kbd>\</kbd> in the list to open the command palette. From there you can create tasks or directories, switch views (List / Calendar / Kanban), and open the Dependency Graph.
        </p>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
          <strong>Search</strong> — Click Search in the header or press Cmd+Shift+S to search tasks by title, description, category, or tags.
        </p>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
          <strong>Navigation</strong> — Use the column layout to drill down: select a directory to see its contents in the next column. Arrow keys move focus; Enter or → opens a directory or task. Use the header (Tab or arrow keys) to reach Search, Settings, and Help.
        </p>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
          <strong>Task links</strong> — In the full edit panel (Cmd+Shift+E on a task), use the Links section to add dependencies or references between tasks. Open the Dependency Graph from the command palette to see all links.
        </p>
        <p style={{ margin: '0 0 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Press Cmd+/ to see all keyboard shortcuts. Escape to close.
        </p>
        <button
          type="button"
          onClick={() => {
            setHelpSheetOpen(false)
            onClose()
          }}
          style={{ padding: '8px 16px' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
