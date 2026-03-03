/**
 * Top bar: Flowstate title, connection indicator, Search, Settings, Help.
 * Focusable by Tab; arrow-key focus between header controls in a later phase (spec §3 Q32).
 */

interface TopBarProps {
  onSettingsClick?: () => void
}

export function TopBar({ onSettingsClick }: TopBarProps) {
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
        aria-label="Connection status"
        title="Connection status"
        style={{ fontSize: 12, color: '#666' }}
      >
        ● Connected
      </span>
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
