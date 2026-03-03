/**
 * Realtime subscriptions for tasks and directories (current user).
 * Optional per Phase 3; subscribe when app shell is mounted and user is set.
 */

import { supabase } from './supabase'
import { parseTask } from './parse'
import type { TaskRow } from '../types'
import type { Directory } from '../types'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'

export function subscribeTasks(userId: string) {
  const channel = supabase
    .channel('tasks')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as TaskRow
          if (row.user_id === userId) {
            useTaskStore.getState().upsertTask(parseTask(row))
          }
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as { id: string }
          useTaskStore.getState().removeTask(row.id)
        }
      }
    )
    .subscribe()

  return async () => {
    await supabase.removeChannel(channel)
  }
}

export function subscribeDirectories(userId: string) {
  const channel = supabase
    .channel('directories')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'directories',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as Directory
          if (row.user_id === userId) {
            useDirectoryStore.getState().upsertDirectory(row)
          }
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as { id: string }
          useDirectoryStore.getState().removeDirectory(row.id)
        }
      }
    )
    .subscribe()

  return async () => {
    await supabase.removeChannel(channel)
  }
}
