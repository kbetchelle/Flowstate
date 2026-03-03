/**
 * Theme store: mode and accent. Applied to root; persist via user_settings (Phase 12+).
 */

import { create } from 'zustand'
import type { ThemeMode } from '../types'

export interface ThemeState {
  mode: ThemeMode
  accent: string | null
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: string | null) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  accent: null,
  setMode: (mode) => set({ mode }),
  setAccent: (accent) => set({ accent }),
}))
