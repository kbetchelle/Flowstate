/**
 * Conflict store: pending conflict for version-based resolution.
 * User chooses version/merge via ConflictDialog (spec §4, Q54).
 */

import { create } from 'zustand'
import type { Task } from '../types'
import type { Directory } from '../types'

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
  /** Full entities for resolveWithVersion and retry save. */
  localEntity: Task | Directory | null
  serverEntity: Task | Directory | null
  open: boolean
  /** Called after user resolves and save succeeds (e.g. to process next offline queue item). */
  onAfterResolved: (() => void) | null
  openConflict: (payload: {
    entityType: ConflictEntity
    entityId: string
    localVersion: number
    serverVersion: number
    conflictingFields: Record<string, { local: unknown; server: unknown }>
    localEntity: Task | Directory
    serverEntity: Task | Directory
  }) => void
  setOnAfterResolved: (cb: (() => void) | null) => void
  closeConflict: () => void
}

export const useConflictStore = create<ConflictState>((set) => ({
  entityType: null,
  entityId: null,
  localVersion: null,
  serverVersion: null,
  conflictingFields: {},
  localEntity: null,
  serverEntity: null,
  open: false,
  onAfterResolved: null,
  setOnAfterResolved: (onAfterResolved) => set({ onAfterResolved }),
  openConflict: ({
    entityType,
    entityId,
    localVersion,
    serverVersion,
    conflictingFields,
    localEntity,
    serverEntity,
  }) =>
    set({
      entityType,
      entityId,
      localVersion,
      serverVersion,
      conflictingFields,
      localEntity,
      serverEntity,
      open: true,
    }),
  closeConflict: () =>
    set({
      entityType: null,
      entityId: null,
      localVersion: null,
      serverVersion: null,
      conflictingFields: {},
      localEntity: null,
      serverEntity: null,
      open: false,
      onAfterResolved: null,
    }),
}))
