/**
 * Auth store: session and user from Supabase.
 * Synced from supabase.auth; no sidebar or saved-view state.
 */

import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  user: User | null
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
}))
