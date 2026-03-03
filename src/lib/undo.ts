/**
 * Undo/redo: in-memory stacks + persist to action_history (Phase 9).
 * Block in editing context (input, textarea, full-edit-panel).
 */

import { insertTask, deleteTask, updateTask } from '../api/tasks'
import { insertDirectory, deleteDirectory, updateDirectory } from '../api/directories'
import { insertAction } from '../api/actionHistory'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import type { Task } from '../types'
import type { Directory } from '../types'

export interface UndoEntry {
  actionType: string
  payload: Record<string, unknown>
}

const MAX_UNDO = 50
let undoStack: UndoEntry[] = []
let redoStack: UndoEntry[] = []

export function getUndoStackLength(): number {
  return undoStack.length
}

export function getRedoStackLength(): number {
  return redoStack.length
}

export async function recordAction(
  userId: string,
  actionType: string,
  payload: Record<string, unknown>
): Promise<void> {
  undoStack = [{ actionType, payload }, ...undoStack].slice(0, MAX_UNDO)
  redoStack = []
  await insertAction(userId, actionType, payload)
}

async function applyTaskCreateInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const task = payload.task as Task
  await deleteTask(userId, task.id)
  useTaskStore.getState().removeTask(task.id)
}

async function applyTaskUpdateInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const previous = payload.previous as Task
  await updateTask(userId, previous.id, { ...previous, version: previous.version })
  useTaskStore.getState().upsertTask({ ...previous, updated_at: new Date().toISOString() })
}

async function applyTaskDeleteInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const task = payload.task as Task
  const inserted = await insertTask(userId, {
    title: task.title,
    directory_id: task.directory_id,
    priority: task.priority,
    start_date: task.start_date,
    due_date: task.due_date,
    background_color: task.background_color,
    category: task.category,
    tags: task.tags ?? [],
    description: task.description ?? '',
    is_completed: task.is_completed,
    completed_at: task.completed_at,
    status: task.status,
    archived_at: task.archived_at,
    archive_reason: task.archive_reason,
    position: task.position,
    recurrence_frequency: task.recurrence_frequency,
    recurrence_interval: task.recurrence_interval,
    recurrence_end_date: task.recurrence_end_date,
    checklist_items: task.checklist_items ?? [],
    estimated_duration_minutes: task.estimated_duration_minutes,
    actual_duration_minutes: task.actual_duration_minutes,
    url: task.url,
    version: task.version,
  })
  useTaskStore.getState().upsertTask(inserted)
}

async function applyDirectoryCreateInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const dir = payload.directory as Directory
  await deleteDirectory(userId, dir.id)
  useDirectoryStore.getState().removeDirectory(dir.id)
}

async function applyDirectoryUpdateInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const previous = payload.previous as Directory
  await updateDirectory(userId, previous.id, { ...previous, version: previous.version })
  useDirectoryStore.getState().upsertDirectory({ ...previous, updated_at: new Date().toISOString() })
}

async function applyDirectoryDeleteInverse(userId: string, payload: Record<string, unknown>): Promise<void> {
  const dir = payload.directory as Directory
  const inserted = await insertDirectory(userId, {
    name: dir.name,
    parent_id: dir.parent_id,
    position: dir.position,
    depth_level: dir.depth_level,
    version: dir.version,
  })
  useDirectoryStore.getState().upsertDirectory(inserted)
}

async function applyBulkDeleteInverse(
  userId: string,
  payload: Record<string, unknown>
): Promise<{ newTaskIds: string[]; newDirectoryIds: string[] }> {
  const tasks = (payload.tasks as Task[]) ?? []
  const directories = (payload.directories as Directory[]) ?? []
  const newDirectoryIds: string[] = []
  const newTaskIds: string[] = []
  for (const dir of directories) {
    const inserted = await insertDirectory(userId, {
      name: dir.name,
      parent_id: dir.parent_id,
      position: dir.position,
      depth_level: dir.depth_level,
      version: dir.version,
    })
    useDirectoryStore.getState().upsertDirectory(inserted)
    newDirectoryIds.push(inserted.id)
  }
  for (const task of tasks) {
    const inserted = await insertTask(userId, {
      title: task.title,
      directory_id: task.directory_id,
      priority: task.priority,
      start_date: task.start_date,
      due_date: task.due_date,
      background_color: task.background_color,
      category: task.category,
      tags: task.tags ?? [],
      description: task.description ?? '',
      is_completed: task.is_completed,
      completed_at: task.completed_at,
      status: task.status,
      archived_at: task.archived_at,
      archive_reason: task.archive_reason,
      position: task.position,
      recurrence_frequency: task.recurrence_frequency,
      recurrence_interval: task.recurrence_interval,
      recurrence_end_date: task.recurrence_end_date,
      checklist_items: task.checklist_items ?? [],
      estimated_duration_minutes: task.estimated_duration_minutes,
      actual_duration_minutes: task.actual_duration_minutes,
      url: task.url,
      version: task.version,
    })
    useTaskStore.getState().upsertTask(inserted)
    newTaskIds.push(inserted.id)
  }
  return { newTaskIds, newDirectoryIds }
}

async function applyInverse(userId: string, entry: UndoEntry): Promise<UndoEntry | null> {
  const { actionType, payload } = entry
  switch (actionType) {
    case 'task_create':
      await applyTaskCreateInverse(userId, payload)
      return null
    case 'task_update':
      await applyTaskUpdateInverse(userId, payload)
      return null
    case 'task_delete':
      await applyTaskDeleteInverse(userId, payload)
      return null
    case 'directory_create':
      await applyDirectoryCreateInverse(userId, payload)
      return null
    case 'directory_update':
      await applyDirectoryUpdateInverse(userId, payload)
      return null
    case 'directory_delete':
      await applyDirectoryDeleteInverse(userId, payload)
      return null
    case 'bulk_delete': {
      const { newTaskIds, newDirectoryIds } = await applyBulkDeleteInverse(userId, payload)
      return { actionType: 'bulk_delete_redo', payload: { taskIds: newTaskIds, directoryIds: newDirectoryIds } }
    }
    case 'paste': {
      const tasks = (payload.tasks as Task[]) ?? []
      const directories = (payload.directories as Directory[]) ?? []
      for (const t of tasks) {
        await deleteTask(userId, t.id)
        useTaskStore.getState().removeTask(t.id)
      }
      for (const d of directories) {
        await deleteDirectory(userId, d.id)
        useDirectoryStore.getState().removeDirectory(d.id)
      }
      return { actionType: 'paste', payload: { tasks, directories } }
    }
    default:
      return null
  }
}

async function applyTaskCreateForward(userId: string, payload: Record<string, unknown>): Promise<void> {
  const task = payload.task as Task
  const inserted = await insertTask(userId, {
    title: task.title,
    directory_id: task.directory_id,
    priority: task.priority,
    start_date: task.start_date,
    due_date: task.due_date,
    background_color: task.background_color,
    category: task.category,
    tags: task.tags ?? [],
    description: task.description ?? '',
    is_completed: task.is_completed,
    completed_at: task.completed_at,
    status: task.status,
    archived_at: task.archived_at,
    archive_reason: task.archive_reason,
    position: task.position,
    recurrence_frequency: task.recurrence_frequency,
    recurrence_interval: task.recurrence_interval,
    recurrence_end_date: task.recurrence_end_date,
    checklist_items: task.checklist_items ?? [],
    estimated_duration_minutes: task.estimated_duration_minutes,
    actual_duration_minutes: task.actual_duration_minutes,
    url: task.url,
    version: task.version,
  })
  useTaskStore.getState().upsertTask(inserted)
}

async function applyDirectoryCreateForward(userId: string, payload: Record<string, unknown>): Promise<void> {
  const dir = payload.directory as Directory
  const inserted = await insertDirectory(userId, {
    name: dir.name,
    parent_id: dir.parent_id,
    position: dir.position,
    depth_level: dir.depth_level,
    version: dir.version,
  })
  useDirectoryStore.getState().upsertDirectory(inserted)
}

async function applyForward(userId: string, entry: UndoEntry): Promise<void> {
  const { actionType, payload } = entry
  switch (actionType) {
    case 'task_create':
      await applyTaskCreateForward(userId, payload)
      break
    case 'task_delete':
      await applyTaskDeleteInverse(userId, payload)
      break
    case 'task_update': {
      const next = payload.next as Task | undefined
      if (next) {
        await updateTask(userId, next.id, { ...next, version: next.version })
        useTaskStore.getState().upsertTask({ ...next, updated_at: new Date().toISOString() })
      }
      break
    }
    case 'directory_create':
      await applyDirectoryCreateForward(userId, payload)
      break
    case 'directory_delete':
      await applyDirectoryDeleteInverse(userId, payload)
      break
    case 'directory_update': {
      const next = payload.next as Directory | undefined
      if (next) {
        await updateDirectory(userId, next.id, { ...next, version: next.version })
        useDirectoryStore.getState().upsertDirectory({ ...next, updated_at: new Date().toISOString() })
      }
      break
    }
    case 'bulk_delete':
    case 'bulk_delete_redo': {
      const taskIds = (payload.taskIds as string[]) ?? []
      const directoryIds = (payload.directoryIds as string[]) ?? []
      for (const id of taskIds) {
        await deleteTask(userId, id)
        useTaskStore.getState().removeTask(id)
      }
      for (const id of directoryIds) {
        await deleteDirectory(userId, id)
        useDirectoryStore.getState().removeDirectory(id)
      }
      break
    }
    case 'paste': {
      await applyBulkDeleteInverse(userId, { tasks: payload.tasks, directories: payload.directories })
      break
    }
    default:
      break
  }
}

export async function undo(userId: string): Promise<boolean> {
  if (undoStack.length === 0) return false
  const entry = undoStack[0]
  undoStack = undoStack.slice(1)
  const redoEntry = await applyInverse(userId, entry)
  redoStack = [redoEntry ?? entry, ...redoStack]
  return true
}

export async function redo(userId: string): Promise<boolean> {
  if (redoStack.length === 0) return false
  const entry = redoStack[0]
  redoStack = redoStack.slice(1)
  await applyForward(userId, entry)
  undoStack = [entry, ...undoStack]
  return true
}
