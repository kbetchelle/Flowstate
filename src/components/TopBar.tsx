/**
 * Top bar: Flowstate title, connection indicator, Search, Settings, Help.
 * Focusable by Tab; arrow-key focus between header controls in a later phase (spec §3 Q32).
 */

import { useRef } from 'react'
import { useNetworkStore } from '../stores/networkStore'
import { useUIStore } from '../stores/uiStore'

interface TopBarProps {
  onSettingsClick?: () => void
  onSearchClick?: () => void
  onHelpClick?: () => void
}

export function TopBar({ onSettingsClick, onSearchClick, onHelpClick }: TopBarProps) {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const grabModeActive = useUIStore((s) => s.grabModeActive)
  const searchRef = useRef<HTMLButtonElement>(null)
  const settingsRef = useRef<HTMLButtonElement>(null)
  const helpRef = useRef<HTMLButtonElement>(null)

  const buttons = [searchRef, settingsRef, helpRef]
  const handleNavKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = buttons[(index - 1 + 3) % 3]
      prev.current?.focus()
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = buttons[(index + 1) % 3]
      next.current?.focus()
    }
  }

  return (
    <header
      role="banner"
      className="glass-surface"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        borderBottom: '1px solid var(--glass-border)',
        borderRadius: 0,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: 600,
        }}
      >
        Flowstate
      </h1>
      <span
        aria-label={isOnline ? 'Connected' : 'Offline'}
        title={isOnline ? 'Connected' : 'Offline'}
        style={{ fontSize: 12, color: isOnline ? 'var(--color-success)' : 'var(--color-error)' }}
      >
        ● {isOnline ? 'Connected' : 'Offline'}
      </span>
      {grabModeActive && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Grab mode: Arrows move drop target, Enter to drop, Esc to cancel.
        </span>
      )}
      <div style={{ flex: 1 }} />
      <nav aria-label="App controls" style={{ display: 'flex', gap: 8 }}>
        <button
          ref={searchRef}
          type="button"
          tabIndex={0}
          style={{ padding: '6px 12px' }}
          onClick={onSearchClick}
          onKeyDown={(e) => handleNavKeyDown(e, 0)}
        >
          Search
        </button>
        <button
          ref={settingsRef}
          type="button"
          tabIndex={0}
          onClick={onSettingsClick}
          style={{ padding: '6px 12px' }}
          onKeyDown={(e) => handleNavKeyDown(e, 1)}
        >
          Settings
        </button>
        <button
          ref={helpRef}
          type="button"
          tabIndex={0}
          style={{ padding: '6px 12px' }}
          onClick={onHelpClick}
          onKeyDown={(e) => handleNavKeyDown(e, 2)}
        >
          Help
        </button>
      </nav>
    </header>
  )
}
