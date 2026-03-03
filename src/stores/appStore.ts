/**
 * App store: view state, navigation path, selection, focus, filters.
 * No URL routing; no sidebar; no saved views (spec §3, §9).
 */

import { create } from 'zustand'
import type { CurrentView } from '../types'

export interface AppState {
  currentView: CurrentView
  setCurrentView: (view: CurrentView) => void

  /** Directory ids from root to current (drill-down columns). */
  navigationPath: string[]
  setNavigationPath: (path: string[]) => void

  /** Selected task/directory ids in current column. */
  selectedItems: string[]
  setSelectedItems: (ids: string[]) => void

  /** Anchor for shift+arrow extend selection (current column). */
  selectionAnchorId: string | null
  setSelectionAnchorId: (id: string | null) => void

  /** Focused item id (single). */
  focusedItemId: string | null
  setFocusedItemId: (id: string | null) => void

  /** Focused column index (0-based). */
  focusedColumnIndex: number
  setFocusedColumnIndex: (index: number) => void

  /** Filter state for current view. */
  showCompleted: boolean
  setShowCompleted: (show: boolean) => void
  colorMode: 'none' | 'category' | 'priority'
  setColorMode: (mode: 'none' | 'category' | 'priority') => void

  /** Command palette open state (Cmd+K or \). */
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'main_db',
  setCurrentView: (currentView) => set({ currentView }),

  navigationPath: [],
  setNavigationPath: (navigationPath) => set({ navigationPath }),

  selectedItems: [],
  setSelectedItems: (selectedItems) => set({ selectedItems }),

  selectionAnchorId: null,
  setSelectionAnchorId: (selectionAnchorId) => set({ selectionAnchorId }),

  focusedItemId: null,
  setFocusedItemId: (focusedItemId) => set({ focusedItemId }),

  focusedColumnIndex: 0,
  setFocusedColumnIndex: (focusedColumnIndex) => set({ focusedColumnIndex }),

  showCompleted: true,
  setShowCompleted: (showCompleted) => set({ showCompleted }),
  colorMode: 'none',
  setColorMode: (colorMode) => set({ colorMode }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))
