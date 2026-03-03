/**
 * Offline mutation queue: persist when offline, process on reconnect (spec §10).
 * Queue items are replayed in order; conflicts open ConflictDialog.
 */

import type { Task } from '../types'
import type { Directory } from '../types'
import { updateWithConflictCheck, archiveTask } from '../api/tasks'
import { updateDirectoryWithConflictCheck } from '../api/directories'
import { findConflictingFields } from '../api/conflictResolution'
import { useConflictStore } from '../stores/conflictStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useNetworkStore } from '../stores/networkStore'

const STORAGE_KEY = 'flowstate_offline_queue'

export type TaskUpdateResult =
  | { ok: true; task: Task }
  | { ok: false; serverVersion: number; serverTask: Task }
  | { queued: true }

export type DirectoryUpdateResult =
  | { ok: true; directory: Directory }
  | { ok: false; serverVersion: number; serverDirectory: Directory }
  | { queued: true }

export interface TaskUpdateItem {
  type: 'task_update'
  userId: string
  taskId: string
  patch: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>> & { version: number }
  localEntity: Task
}

export interface DirectoryUpdateItem {
  type: 'directory_update'
  userId: string
  directoryId: string
  patch: Partial<Omit<Directory, 'id' | 'user_id' | 'created_at'>> & { version: number }
  localEntity: Directory
}

export interface TaskArchiveItem {
  type: 'task_archive'
  userId: string
  taskId: string
  reason: string
}

export type OfflineQueueItem = TaskUpdateItem | DirectoryUpdateItem | TaskArchiveItem

function loadQueue(): OfflineQueueItem[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(queue: OfflineQueueItem[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    }
  } catch {
    // ignore
  }
}

export function getOfflineQueue(): OfflineQueueItem[] {
  return loadQueue()
}

export function enqueueOffline(item: OfflineQueueItem): void {
  const queue = loadQueue()
  queue.push(item)
  saveQueue(queue)
}

export function removeFirstOffline(): OfflineQueueItem | null {
  const queue = loadQueue()
  const first = queue.shift() ?? null
  saveQueue(queue)
  return first
}

export function clearOfflineQueue(): void {
  saveQueue([])
}

export function isOfflineQueueEmpty(): boolean {
  return loadQueue().length === 0
}

/**
 * Run task update or enqueue when offline. Optimistically updates store when queued.
 */
export async function runOrEnqueueTaskUpdate(
  userId: string,
  taskId: string,
  patch: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>> & { version: number },
  localEntity: Task
): Promise<TaskUpdateResult> {
  if (useNetworkStore.getState().isOnline) {
    return updateWithConflictCheck(userId, taskId, patch)
  }
  enqueueOffline({ type: 'task_update', userId, taskId, patch, localEntity })
  useTaskStore.getState().upsertTask(localEntity)
  return { queued: true }
}

/**
 * Run directory update or enqueue when offline. Optimistically updates store when queued.
 */
export async function runOrEnqueueDirectoryUpdate(
  userId: string,
  directoryId: string,
  patch: Partial<Omit<Directory, 'id' | 'user_id' | 'created_at'>> & { version: number },
  localEntity: Directory
): Promise<DirectoryUpdateResult> {
  if (useNetworkStore.getState().isOnline) {
    return updateDirectoryWithConflictCheck(userId, directoryId, patch)
  }
  enqueueOffline({ type: 'directory_update', userId, directoryId, patch, localEntity })
  useDirectoryStore.getState().upsertDirectory(localEntity)
  return { queued: true }
}

/**
 * Process one or more queued items. Stops when queue is empty or a conflict is opened.
 * Call when coming back online. If a conflict is opened, set onAfterResolved so that
 * when the user resolves, this is called again to continue.
 */
export async function processOfflineQueue(userId: string): Promise<void> {
  const openConflict = useConflictStore.getState().openConflict
  const setOnAfterResolved = useConflictStore.getState().setOnAfterResolved
  const upsertTask = useTaskStore.getState().upsertTask
  const upsertDirectory = useDirectoryStore.getState().upsertDirectory

  while (!isOfflineQueueEmpty()) {
    const item = removeFirstOffline()
    if (!item) break

    if (item.type === 'task_update') {
      const result = await updateWithConflictCheck(userId, item.taskId, item.patch)
      if (result.ok) {
        upsertTask(result.task)
        continue
      }
      const conflictingFields = findConflictingFields(item.localEntity, result.serverTask)
      openConflict({
        entityType: 'task',
        entityId: item.taskId,
        localVersion: item.patch.version,
        serverVersion: result.serverVersion,
        conflictingFields,
        localEntity: item.localEntity,
        serverEntity: result.serverTask,
      })
      setOnAfterResolved(() => processOfflineQueue(userId))
      return
    }

    if (item.type === 'directory_update') {
      const result = await updateDirectoryWithConflictCheck(
        userId,
        item.directoryId,
        item.patch
      )
      if (result.ok) {
        upsertDirectory(result.directory)
        continue
      }
      const conflictingFields = findConflictingFields(item.localEntity, result.serverDirectory)
      openConflict({
        entityType: 'directory',
        entityId: item.directoryId,
        localVersion: item.patch.version,
        serverVersion: result.serverVersion,
        conflictingFields,
        localEntity: item.localEntity,
        serverEntity: result.serverDirectory,
      })
      setOnAfterResolved(() => processOfflineQueue(userId))
      return
    }

    if (item.type === 'task_archive') {
      const task = await archiveTask(userId, item.taskId, item.reason)
      upsertTask(task)
    }
  }
}
