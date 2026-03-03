/**
 * Clipboard for copy/cut/paste (spec §5, Phase 9).
 * Single paste = always with metadata (target directory, position).
 */

import { create } from 'zustand'
import type { Task } from '../types'
import type { Directory } from '../types'

export interface ClipboardContents {
  tasks: Task[]
  directories: Directory[]
}

export interface ClipboardState {
  contents: ClipboardContents | null
  isCut: boolean
  setContents: (tasks: Task[], directories: Directory[], isCut: boolean) => void
  clear: () => void
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  contents: null,
  isCut: false,
  setContents: (tasks, directories, isCut) =>
    set({ contents: { tasks, directories }, isCut }),
  clear: () => set({ contents: null, isCut: false }),
}))
