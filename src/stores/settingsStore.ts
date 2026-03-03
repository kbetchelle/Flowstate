/**
 * Settings store: user settings (theme, accent, custom_shortcuts).
 * Persisted via user_settings API; no saved views (spec §8).
 */

import { create } from 'zustand'
import type { UserSettings } from '../types'

export interface SettingsState {
  settings: UserSettings | null
  setSettings: (settings: UserSettings | null) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
}))
