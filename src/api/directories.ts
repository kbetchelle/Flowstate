/**
 * Directories API: fetch, CRUD, conflict check.
 * Spec §4; no sidebar state (spec §8).
 */

import { supabase } from '../lib/supabase'
import type { Directory } from '../types'

export async function fetchDirectories(userId: string): Promise<Directory[]> {
  const { data, error } = await supabase
    .from('directories')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data as Directory[])
}

export async function fetchDirectoriesByParent(
  userId: string,
  parentId: string | null
): Promise<Directory[]> {
  let q = supabase
    .from('directories')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (parentId === null) {
    q = q.is('parent_id', null)
  } else {
    q = q.eq('parent_id', parentId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data as Directory[])
}

export async function insertDirectory(
  userId: string,
  dir: Omit<Directory, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Directory> {
  const { data, error } = await supabase
    .from('directories')
    .insert({ ...dir, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Directory
}

export async function updateDirectory(
  userId: string,
  id: string,
  patch: Partial<Omit<Directory, 'id' | 'user_id' | 'created_at'>> & { version: number }
): Promise<Directory> {
  const { data, error } = await supabase
    .from('directories')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Directory
}

export async function deleteDirectory(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('directories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function fetchDirectory(
  userId: string,
  id: string
): Promise<Directory | null> {
  const { data, error } = await supabase
    .from('directories')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as Directory
}

/**
 * Update with conflict check (version). Caller handles ConflictDialog.
 */
export async function updateDirectoryWithConflictCheck(
  userId: string,
  id: string,
  patch: Partial<Omit<Directory, 'id' | 'user_id' | 'created_at'>> & { version: number }
): Promise<
  | { ok: true; directory: Directory }
  | { ok: false; serverVersion: number; serverDirectory: Directory }
> {
  const existing = await fetchDirectory(userId, id)
  if (!existing) throw new Error('Directory not found')
  if (existing.version !== patch.version) {
    return {
      ok: false,
      serverVersion: existing.version,
      serverDirectory: existing,
    }
  }
  const nextVersion = patch.version + 1
  const directory = await updateDirectory(userId, id, { ...patch, version: nextVersion })
  return { ok: true, directory }
}
