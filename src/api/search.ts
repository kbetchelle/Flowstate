/**
 * Search API: search tasks by filters (text, directory, status, etc.).
 * Spec §7.
 */

import { supabase } from '../lib/supabase'
import { parseTask } from '../lib/parse'
import type { Task, TaskRow } from '../types'

export interface SearchFilters {
  query?: string
  directoryId?: string | null
  isCompleted?: boolean
  status?: Task['status']
  limit?: number
}

export async function searchTasks(
  userId: string,
  filters: SearchFilters = {}
): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (filters.directoryId !== undefined) {
    if (filters.directoryId === null) {
      q = q.is('directory_id', null)
    } else {
      q = q.eq('directory_id', filters.directoryId)
    }
  }
  if (filters.isCompleted !== undefined) {
    q = q.eq('is_completed', filters.isCompleted)
  }
  if (filters.status !== undefined) {
    q = q.eq('status', filters.status)
  }
  if (filters.limit !== undefined) {
    q = q.limit(filters.limit)
  }

  const { data, error } = await q
  if (error) throw error
  let tasks = (data as TaskRow[]).map(parseTask)

  if (filters.query?.trim()) {
    const lower = filters.query.trim().toLowerCase()
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        (t.description && t.description.toLowerCase().includes(lower)) ||
        (t.category && t.category.toLowerCase().includes(lower)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lower))
    )
  }

  return tasks
}
