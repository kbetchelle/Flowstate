/**
 * Shortcut sheet: Cmd+/ shows list of keyboard shortcuts (spec §5).
 * Phase 12; keep separate from Help (spec Q44).
 */

import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { SHORTCUT_SHEET_ENTRIES } from '../constants/shortcuts'

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const setShortcutSheetOpen = useAppStore((s) => s.setShortcutSheetOpen)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShortcutSheetOpen(false)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setShortcutSheetOpen, onClose])

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShortcutSheetOpen(false)
          onClose()
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #fff)',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxWidth: 480,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Keyboard shortcuts</h2>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: 14 }}>
          Escape to close.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {SHORTCUT_SHEET_ENTRIES.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td
                  style={{
                    padding: '8px 12px 8px 0',
                    verticalAlign: 'top',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.keys}
                </td>
                <td style={{ padding: 8, color: '#333' }}>{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              setShortcutSheetOpen(false)
              onClose()
            }}
            style={{ padding: '8px 16px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
