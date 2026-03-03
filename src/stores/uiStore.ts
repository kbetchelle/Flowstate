/**
 * UI store: creation state, edit panel state, drag state.
 * No CreationModal; no sidebar state (spec §8).
 */

import { create } from 'zustand'

export interface UIState {
  /** Whether we're in a dedicated creation context (t/d for new task/dir). */
  creationContextActive: boolean
  setCreationContextActive: (v: boolean) => void

  /** Full edit panel: open and which task id. */
  editPanelTaskId: string | null
  setEditPanelTaskId: (id: string | null) => void

  /** Drag state for reorder/move. */
  isDragging: boolean
  setDragging: (v: boolean) => void
  dragSourceId: string | null
  setDragSourceId: (id: string | null) => void

  /** After palette "New task/directory", focus this id for inline naming. */
  namingNewItemId: string | null
  setNamingNewItemId: (id: string | null) => void

  /** Pending delete confirmation (Phase 9). Enter = confirm, Escape = cancel. */
  pendingDeleteIds: string[] | null
  setPendingDeleteIds: (ids: string[] | null) => void

  /** Grab mode (Ctrl+Space then G): move selection with arrows, Enter to drop, Escape to cancel. */
  grabModeActive: boolean
  setGrabModeActive: (v: boolean) => void
  /** Drop target item id when in grab mode (where selection will be moved). */
  grabDropTargetId: string | null
  setGrabDropTargetId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  creationContextActive: false,
  setCreationContextActive: (creationContextActive) => set({ creationContextActive }),

  editPanelTaskId: null,
  setEditPanelTaskId: (editPanelTaskId) => set({ editPanelTaskId }),

  isDragging: false,
  setDragging: (isDragging) => set({ isDragging }),
  dragSourceId: null,
  setDragSourceId: (dragSourceId) => set({ dragSourceId }),

  namingNewItemId: null,
  setNamingNewItemId: (namingNewItemId) => set({ namingNewItemId }),

  pendingDeleteIds: null,
  setPendingDeleteIds: (pendingDeleteIds) => set({ pendingDeleteIds }),

  grabModeActive: false,
  setGrabModeActive: (grabModeActive) => set({ grabModeActive }),
  grabDropTargetId: null,
  setGrabDropTargetId: (grabDropTargetId) => set({ grabDropTargetId }),
}))
