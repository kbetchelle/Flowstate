/**
 * Links API: fetch for user/task, create, delete.
 * Spec §4 task_links.
 */

import { supabase } from '../lib/supabase'
import type { TaskLink, TaskLinkType } from '../types'

export async function fetchLinksForUser(userId: string): Promise<TaskLink[]> {
  const { data, error } = await supabase
    .from('task_links')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data as TaskLink[])
}

export async function fetchLinksForTask(
  userId: string,
  taskId: string
): Promise<TaskLink[]> {
  const { data, error } = await supabase
    .from('task_links')
    .select('*')
    .eq('user_id', userId)
    .or(`source_id.eq.${taskId},target_id.eq.${taskId}`)
  if (error) throw error
  return (data as TaskLink[])
}

export async function createLink(
  userId: string,
  sourceId: string,
  targetId: string,
  linkType: TaskLinkType
): Promise<TaskLink> {
  const { data, error } = await supabase
    .from('task_links')
    .insert({
      source_id: sourceId,
      target_id: targetId,
      link_type: linkType,
      user_id: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data as TaskLink
}

export async function deleteLink(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('task_links')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
