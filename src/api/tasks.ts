/**
 * Tasks API: fetch, insert, update, delete, archive, unarchive, updateWithConflictCheck.
 * Spec §4; no time tracking (spec §8).
 */

import { supabase } from '../lib/supabase'
import { parseTask } from '../lib/parse'
import type { Task, TaskRow } from '../types'

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data as TaskRow[]).map(parseTask)
}

export async function fetchTasksByDirectory(
  userId: string,
  directoryId: string | null
): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (directoryId === null) {
    q = q.is('directory_id', null)
  } else {
    q = q.eq('directory_id', directoryId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data as TaskRow[]).map(parseTask)
}

function taskToRow(task: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...task }
  if (Array.isArray((task as Task).checklist_items)) {
    row.checklist_items = (task as Task).checklist_items
  }
  return row
}

export async function insertTask(
  userId: string,
  task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow({ ...task, user_id: userId }) as Record<string, unknown>)
    .select()
    .single()
  if (error) throw error
  return parseTask(data as TaskRow)
}

export async function updateTask(
  userId: string,
  id: string,
  patch: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>> & { version: number }
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...taskToRow(patch),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return parseTask(data as TaskRow)
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function archiveTask(
  userId: string,
  id: string,
  reason?: string
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return parseTask(data as TaskRow)
}

export async function unarchiveTask(userId: string, id: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      archived_at: null,
      archive_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return parseTask(data as TaskRow)
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

/**
 * Archive completed tasks older than 5 days (spec §4 Q55).
 * Call after loading tasks; returns updated tasks to upsert into store.
 */
export async function autoArchiveCompletedOlderThan5Days(
  userId: string,
  tasks: Task[]
): Promise<Task[]> {
  const cutoff = new Date(Date.now() - FIVE_DAYS_MS).toISOString()
  const toArchive = tasks.filter(
    (t) =>
      t.is_completed &&
      t.completed_at != null &&
      t.completed_at < cutoff &&
      t.archived_at == null
  )
  const updated: Task[] = []
  for (const t of toArchive) {
    try {
      const archived = await archiveTask(userId, t.id, 'auto')
      updated.push(archived)
    } catch {
      // ignore per-task errors
    }
  }
  return updated
}

/** Fetch current version of a task. */
export async function fetchTask(
  userId: string,
  id: string
): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return parseTask(data as TaskRow)
}

/**
 * Update with conflict check: compare version; if server version differs, throw or return conflict info.
 * Caller should run conflict resolution (ConflictDialog) and retry (spec §4, Q54).
 */
export async function updateWithConflictCheck(
  userId: string,
  id: string,
  patch: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>> & { version: number }
): Promise<{ ok: true; task: Task } | { ok: false; serverVersion: number; serverTask: Task }> {
  const existing = await fetchTask(userId, id)
  if (!existing) throw new Error('Task not found')
  if (existing.version !== patch.version) {
    return {
      ok: false,
      serverVersion: existing.version,
      serverTask: existing,
    }
  }
  const nextVersion = patch.version + 1
  const task = await updateTask(userId, id, { ...patch, version: nextVersion })
  return { ok: true, task }
}
