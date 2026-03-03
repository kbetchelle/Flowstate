/**
 * Conflict resolution: find conflicting fields, attempt auto-resolve, resolve with version.
 * Spec §4 (version field, ConflictDialog choose version); no last-write-wins only (Q54).
 */

import type { Task } from '../types'
import type { Directory } from '../types'

type Entity = Task | Directory

const VERSION_FIELD = 'version'
const METADATA_FIELDS = new Set(['created_at', 'updated_at', 'user_id'])

/** Compare two entities and return field-level diffs (excluding version and metadata). */
export function findConflictingFields(
  local: Entity,
  server: Entity
): Record<string, { local: unknown; server: unknown }> {
  const out: Record<string, { local: unknown; server: unknown }> = {}
  const keys = new Set([
    ...Object.keys(local as object),
    ...Object.keys(server as object),
  ]) as Set<keyof Entity>
  for (const key of keys) {
    if (key === VERSION_FIELD || METADATA_FIELDS.has(key as string)) continue
    const l = (local as unknown as Record<string, unknown>)[key as string]
    const s = (server as unknown as Record<string, unknown>)[key as string]
    if (JSON.stringify(l) !== JSON.stringify(s)) {
      out[key as string] = { local: l, server: s }
    }
  }
  return out
}

/**
 * Attempt auto-resolve: if no conflicting fields (only version differs), return merged with server version + 1.
 * Otherwise return null (caller shows ConflictDialog).
 */
export function attemptAutoResolve<T extends Entity>(
  local: T,
  server: T
): T | null {
  const conflicts = findConflictingFields(local, server)
  if (Object.keys(conflicts).length === 0) {
    return { ...server, version: (server.version as number) + 1 } as T
  }
  return null
}

/**
 * Resolve with chosen version: build merged entity using 'mine' | 'theirs' per field.
 * Returns entity with version = server.version + 1 for the next save.
 */
export function resolveWithVersion<T extends Entity>(
  local: T,
  server: T,
  choices: Record<string, 'mine' | 'theirs'>
): T {
  const merged = { ...server } as Record<string, unknown>
  for (const [field, choice] of Object.entries(choices)) {
    if (choice === 'mine') {
      merged[field] = (local as unknown as Record<string, unknown>)[field]
    } else {
      merged[field] = (server as unknown as Record<string, unknown>)[field]
    }
  }
  ;(merged as { version: number }).version = (server as { version: number }).version + 1
  return merged as T
}
