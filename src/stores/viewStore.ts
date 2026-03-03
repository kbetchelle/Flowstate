/**
 * View store: list | calendar | kanban per directory (or global).
 * Switch only via command palette (spec §3, §5).
 */

import { create } from 'zustand'

export type ViewType = 'list' | 'calendar' | 'kanban'

export interface ViewState {
  /** View type per directory id; fallback for current directory. */
  viewTypeByDirectory: Record<string, ViewType>
  defaultViewType: ViewType
  getViewType: (directoryId: string | null) => ViewType
  setViewType: (directoryId: string | null, type: ViewType) => void
}

export const useViewStore = create<ViewState>((set, get) => ({
  viewTypeByDirectory: {},
  defaultViewType: 'list',
  getViewType: (directoryId) => {
    const state = get()
    if (directoryId && state.viewTypeByDirectory[directoryId])
      return state.viewTypeByDirectory[directoryId]
    return state.defaultViewType
  },
  setViewType: (directoryId, type) =>
    set((state) => {
      if (!directoryId) {
        return { defaultViewType: type }
      }
      return {
        viewTypeByDirectory: {
          ...state.viewTypeByDirectory,
          [directoryId]: type,
        },
      }
    }),
}))
