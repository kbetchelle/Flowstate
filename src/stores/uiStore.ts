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
}))
