/**
 * Conflict store: pending conflict for version-based resolution.
 * User chooses version/merge via ConflictDialog (spec §4, Q54).
 */

import { create } from 'zustand'

export type ConflictEntity = 'task' | 'directory'

export interface ConflictState {
  entityType: ConflictEntity | null
  entityId: string | null
  /** Local version we tried to save. */
  localVersion: number | null
  /** Server version at conflict. */
  serverVersion: number | null
  /** Field-level diffs for merge UI. */
  conflictingFields: Record<string, { local: unknown; server: unknown }>
  open: boolean
  openConflict: (payload: {
    entityType: ConflictEntity
    entityId: string
    localVersion: number
    serverVersion: number
    conflictingFields: Record<string, { local: unknown; server: unknown }>
  }) => void
  closeConflict: () => void
}

export const useConflictStore = create<ConflictState>((set) => ({
  entityType: null,
  entityId: null,
  localVersion: null,
  serverVersion: null,
  conflictingFields: {},
  open: false,
  openConflict: ({ entityType, entityId, localVersion, serverVersion, conflictingFields }) =>
    set({
      entityType,
      entityId,
      localVersion,
      serverVersion,
      conflictingFields,
      open: true,
    }),
  closeConflict: () =>
    set({
      entityType: null,
      entityId: null,
      localVersion: null,
      serverVersion: null,
      conflictingFields: {},
      open: false,
    }),
}))
