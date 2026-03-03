/**
 * Network store: online/offline for offline support and connection indicator.
 */

import { create } from 'zustand'

export interface NetworkState {
  isOnline: boolean
  setOnline: (v: boolean) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (isOnline) => set({ isOnline }),
}))
