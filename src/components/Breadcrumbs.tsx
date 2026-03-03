/**
 * Breadcrumbs: current navigation path (Root > Folder A > Folder B).
 * No sidebar; no click-to-navigate required for Phase 4 (spec Q31).
 */

import { useAppStore } from '../stores/appStore'
import { useDirectoryStore } from '../stores/directoryStore'

export function Breadcrumbs() {
  const navigationPath = useAppStore((s) => s.navigationPath)
  const directories = useDirectoryStore((s) => s.directories)

  const segments = [
    'Root',
    ...navigationPath.map((id) => {
      const dir = directories.find((d) => d.id === id)
      return dir?.name ?? id.slice(0, 8)
    }),
  ]

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        padding: '8px 0',
        fontSize: 14,
        color: '#666',
      }}
    >
      {segments.join(' > ')}
    </nav>
  )
}
