/**
 * Profile store: cached user profile.
 * Loaded in AppShellWithRealtime alongside settings and tasks.
 */

import { create } from 'zustand'
import type { Profile } from '../types'

export interface ProfileState {
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}))
