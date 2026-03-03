/**
 * Directory store: in-memory directory tree for current user.
 * Populated via API; no sidebar state (spec §8).
 */

import { create } from 'zustand'
import type { Directory } from '../types'

export interface DirectoryState {
  directories: Directory[]
  setDirectories: (directories: Directory[]) => void
  upsertDirectory: (dir: Directory) => void
  removeDirectory: (id: string) => void
}

export const useDirectoryStore = create<DirectoryState>((set) => ({
  directories: [],
  setDirectories: (directories) => set({ directories }),
  upsertDirectory: (dir) =>
    set((state) => {
      const idx = state.directories.findIndex((d) => d.id === dir.id)
      const next = [...state.directories]
      if (idx >= 0) next[idx] = dir
      else next.push(dir)
      return { directories: next }
    }),
  removeDirectory: (id) =>
    set((state) => ({
      directories: state.directories.filter((d) => d.id !== id),
    })),
}))
