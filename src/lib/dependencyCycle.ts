/**
 * Cycle detection for dependency links. Adding sourceId -> targetId (dependency)
 * would create a cycle if targetId can reach sourceId via existing dependency edges.
 */

import type { TaskLink } from '../types'

/** Returns true if adding a dependency from sourceId to targetId would create a cycle. */
export function wouldCreateDependencyCycle(
  links: TaskLink[],
  sourceId: string,
  targetId: string
): boolean {
  const depLinks = links.filter((l) => l.link_type === 'dependency')
  const outEdges = new Map<string, string[]>()
  for (const l of depLinks) {
    const list = outEdges.get(l.source_id) ?? []
    list.push(l.target_id)
    outEdges.set(l.source_id, list)
  }
  const visited = new Set<string>()
  const queue = [targetId]
  while (queue.length > 0) {
    const node = queue.shift()!
    if (node === sourceId) return true
    if (visited.has(node)) continue
    visited.add(node)
    const next = outEdges.get(node) ?? []
    for (const n of next) {
      if (!visited.has(n)) queue.push(n)
    }
  }
  return false
}
