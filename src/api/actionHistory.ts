/**
 * Action history API: load, insert for undo.
 * Spec §4 action_history; undo/redo in Phase 9.
 */

import { supabase } from '../lib/supabase'

export interface ActionRecord {
  id?: string
  user_id: string
  action_type: string
  payload: Record<string, unknown>
  created_at?: string
}

export async function loadActionHistory(
  userId: string,
  limit = 50
): Promise<ActionRecord[]> {
  const { data, error } = await supabase
    .from('action_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ActionRecord[]) ?? []
}

export async function insertAction(
  userId: string,
  actionType: string,
  payload: Record<string, unknown>
): Promise<ActionRecord> {
  const { data, error } = await supabase
    .from('action_history')
    .insert({
      user_id: userId,
      action_type: actionType,
      payload: payload ?? {},
    })
    .select()
    .single()
  if (error) throw error
  return data as ActionRecord
}
