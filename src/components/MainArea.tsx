/**
 * Main content area: placeholder per currentView (main_db | upcoming | archive | settings).
 * main_db: Breadcrumbs + column drill-down. No sidebar (spec §3, §9).
 */

import type { CurrentView } from '../types'
import { Breadcrumbs } from './Breadcrumbs'
import { ColumnView } from './ColumnView'

interface MainAreaProps {
  currentView: CurrentView
}

const labels: Record<CurrentView, string> = {
  main_db: 'Main',
  upcoming: 'Upcoming',
  archive: 'Archive',
  settings: 'Settings',
}

export function MainArea({ currentView }: MainAreaProps) {
  if (currentView === 'main_db') {
    return (
      <main
        role="main"
        data-command-palette-context
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 24px 0' }}>
          <Breadcrumbs />
        </div>
        <ColumnView />
      </main>
    )
  }

  return (
    <main
      role="main"
      data-command-palette-context
      style={{
        flex: 1,
        padding: 24,
        overflow: 'auto',
      }}
    >
      <p style={{ margin: 0, color: '#666' }}>{labels[currentView]}</p>
    </main>
  )
}
