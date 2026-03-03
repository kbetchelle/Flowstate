/**
 * Main content area: placeholder per currentView (main_db | upcoming | archive | settings).
 * No sidebar; view state only (spec §3, §9).
 */

import type { CurrentView } from '../types'

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
  return (
    <main
      role="main"
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
