/**
 * Top bar: Flowstate title, connection indicator, Search, Settings, Help.
 * Focusable by Tab; arrow-key focus between header controls in a later phase (spec §3 Q32).
 */

import { useNetworkStore } from '../stores/networkStore'
import { useUIStore } from '../stores/uiStore'

interface TopBarProps {
  onSettingsClick?: () => void
}

export function TopBar({ onSettingsClick }: TopBarProps) {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const grabModeActive = useUIStore((s) => s.grabModeActive)
  return (
    <header
      role="banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
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
        style={{ fontSize: 12, color: isOnline ? '#2e7d32' : '#c62828' }}
      >
        ● {isOnline ? 'Connected' : 'Offline'}
      </span>
      {grabModeActive && (
        <span style={{ fontSize: 12, color: '#666' }}>
          Grab mode: Arrows move drop target, Enter to drop, Esc to cancel.
        </span>
      )}
      <div style={{ flex: 1 }} />
      <nav aria-label="App controls" style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          tabIndex={0}
          style={{ padding: '6px 12px' }}
        >
          Search
        </button>
        <button
          type="button"
          tabIndex={0}
          onClick={onSettingsClick}
          style={{ padding: '6px 12px' }}
        >
          Settings
        </button>
        <button
          type="button"
          tabIndex={0}
          style={{ padding: '6px 12px' }}
        >
          Help
        </button>
      </nav>
    </header>
  )
}
