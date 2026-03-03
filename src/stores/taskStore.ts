/**
 * Task store: in-memory task list for current user.
 * Populated via API; no time tracking (spec §8).
 */

import { create } from 'zustand'
import type { Task } from '../types'

export interface TaskState {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  upsertTask: (task: Task) => void
  removeTask: (id: string) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id)
      const next = [...state.tasks]
      if (idx >= 0) next[idx] = task
      else next.push(task)
      return { tasks: next }
    }),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),
}))
