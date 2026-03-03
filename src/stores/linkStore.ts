/**
 * Link store: task links (dependencies/references) for current user.
 */

import { create } from 'zustand'
import type { TaskLink } from '../types'

export interface LinkState {
  links: TaskLink[]
  setLinks: (links: TaskLink[]) => void
  addLink: (link: TaskLink) => void
  removeLink: (id: string) => void
}

export const useLinkStore = create<LinkState>((set) => ({
  links: [],
  setLinks: (links) => set({ links }),
  addLink: (link) =>
    set((state) => ({ links: [...state.links, link] })),
  removeLink: (id) =>
    set((state) => ({
      links: state.links.filter((l) => l.id !== id),
    })),
}))
