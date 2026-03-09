/**
 * Clipboard / paste behavior (spec §5, §8).
 * Single paste action (Cmd+V) always applies metadata (target directory, position).
 * Phase 9: copy, cut, paste, copy recursive.
 */

import { useAppStore } from '../stores/appStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useClipboardStore } from '../stores/clipboardStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import { insertTask, deleteTask } from '../api/tasks'
import { insertDirectory, deleteDirectory } from '../api/directories'
import { recordAction } from './undo'
import type { Task } from '../types'
import type { Directory } from '../types'

export const PASTE_ALWAYS_WITH_METADATA = true

function getSelectedTasksAndDirs(
  selectedIds: string[],
  tasks: Task[],
  directories: Directory[]
): { tasks: Task[]; directories: Directory[] } {
  const taskIds = new Set(selectedIds)
  const dirIds = new Set(selectedIds)
  return {
    tasks: tasks.filter((t) => taskIds.has(t.id)),
    directories: directories.filter((d) => dirIds.has(d.id)),
  }
}

/** Copy selected items (flat). */
export function copySelection(): boolean {
  const { selectedItems } = useAppStore.getState()
  if (selectedItems.length === 0) return false
  const tasks = useTaskStore.getState().tasks
  const directories = useDirectoryStore.getState().directories
  const { tasks: selTasks, directories: selDirs } = getSelectedTasksAndDirs(
    selectedItems,
    tasks,
    directories
  )
  if (selTasks.length === 0 && selDirs.length === 0) return false
  useClipboardStore.getState().setContents(selTasks, selDirs, false)
  return true
}

/** Cut selected items (flat). */
export function cutSelection(): boolean {
  const ok = copySelection()
  if (!ok) return false
  useClipboardStore.setState({ isCut: true })
  return true
}

/** Copy recursive: for directories include all descendants and their tasks; for tasks just the task. */
export function copyRecursive(): boolean {
  const { selectedItems } = useAppStore.getState()
  if (selectedItems.length === 0) return false
  const tasks = useTaskStore.getState().tasks
  const directories = useDirectoryStore.getState().directories
  const dirIds = new Set(selectedItems.filter((id) => directories.some((d) => d.id === id)))
  const taskIds = new Set(selectedItems.filter((id) => tasks.some((t) => t.id === id)))

  const collectedDirs: Directory[] = []
  const collectedTasks: Task[] = []

  function collectDirAndDescendants(dirId: string) {
    const dir = directories.find((d) => d.id === dirId)
    if (!dir) return
    if (!collectedDirs.some((d) => d.id === dir.id)) {
      collectedDirs.push(dir)
      const children = directories.filter((d) => d.parent_id === dirId)
      children.forEach((d) => collectDirAndDescendants(d.id))
      const tasksInDir = tasks.filter((t) => t.directory_id === dirId)
      tasksInDir.forEach((t) => collectedTasks.push(t))
    }
  }

  for (const id of dirIds) collectDirAndDescendants(id)
  for (const id of taskIds) {
    const t = tasks.find((x) => x.id === id)
    if (t) collectedTasks.push(t)
  }

  if (collectedTasks.length === 0 && collectedDirs.length === 0) return false
  useClipboardStore.getState().setContents(collectedTasks, collectedDirs, false)
  return true
}

const PASTE_ROOT_TASK_MESSAGE = 'Tasks must live inside a directory. Please create the directory or move inside a directory to create a task'

/** Paste into target directory; always applies metadata (target dir, position). Returns new task/dir ids for focus. */
export async function paste(
  userId: string,
  targetDirectoryId: string | null
): Promise<{ newTaskIds: string[]; newDirectoryIds: string[] }> {
  const { contents, isCut } = useClipboardStore.getState()
  if (!contents || (contents.tasks.length === 0 && contents.directories.length === 0)) {
    return { newTaskIds: [], newDirectoryIds: [] }
  }

  if (targetDirectoryId === null && contents.tasks.length > 0) {
    useFeedbackStore.getState().addToast('error', PASTE_ROOT_TASK_MESSAGE)
  }

  const upsertTask = useTaskStore.getState().upsertTask
  const upsertDirectory = useDirectoryStore.getState().upsertDirectory

  const newTaskIds: string[] = []
  const newDirectoryIds: string[] = []
  const insertedTasks: Task[] = []
  const insertedDirs: Directory[] = []

  const dirsToCreate = [...contents.directories].sort((a, b) => a.depth_level - b.depth_level)
  const tasksToCreate = targetDirectoryId === null ? [] : contents.tasks

  const oldDirIdToNew = new Map<string, string>()
  let nextDirPosition = 0
  const existingDirsInTarget = useDirectoryStore
    .getState()
    .directories.filter((d) => d.parent_id === targetDirectoryId)
  if (existingDirsInTarget.length > 0) {
    nextDirPosition = Math.max(...existingDirsInTarget.map((d) => d.position)) + 1
  }

  for (const dir of dirsToCreate) {
    const parentId = dir.parent_id === null ? targetDirectoryId : oldDirIdToNew.get(dir.parent_id) ?? targetDirectoryId
    const depthLevel = parentId === null ? 0 : (useDirectoryStore.getState().directories.find((d) => d.id === parentId)?.depth_level ?? 0) + 1
    const newDir = await insertDirectory(userId, {
      name: dir.name,
      parent_id: parentId,
      position: nextDirPosition++,
      depth_level: depthLevel,
      version: 1,
    })
    oldDirIdToNew.set(dir.id, newDir.id)
    upsertDirectory(newDir)
    newDirectoryIds.push(newDir.id)
    insertedDirs.push(newDir)
  }

  const nextPositionByDir = new Map<string | null, number>()
  function getNextPosition(dirId: string | null): number {
    const current = nextPositionByDir.get(dirId) ?? 0
    nextPositionByDir.set(dirId, current + 1)
    return current
  }
  const existingTasksInTarget = useTaskStore
    .getState()
    .tasks.filter((t) => t.directory_id === targetDirectoryId && !t.archived_at)
  if (existingTasksInTarget.length > 0) {
    nextPositionByDir.set(targetDirectoryId, Math.max(...existingTasksInTarget.map((t) => t.position)) + 1)
  }

  for (const task of tasksToCreate) {
    const targetDir = oldDirIdToNew.get(task.directory_id ?? '') ?? targetDirectoryId
    const position = getNextPosition(targetDir)
    const newTask = await insertTask(userId, {
      title: task.title,
      directory_id: targetDir,
      priority: task.priority,
      start_date: task.start_date,
      due_date: task.due_date,
      background_color: task.background_color,
      category: task.category,
      tags: task.tags ?? [],
      description: task.description ?? '',
      is_completed: false,
      completed_at: null,
      status: task.status,
      archived_at: null,
      archive_reason: null,
      position,
      recurrence_frequency: task.recurrence_frequency,
      recurrence_interval: task.recurrence_interval,
      recurrence_end_date: task.recurrence_end_date,
      checklist_items: task.checklist_items ?? [],
      estimated_duration_minutes: task.estimated_duration_minutes,
      actual_duration_minutes: task.actual_duration_minutes,
      url: task.url,
      version: 1,
    })
    upsertTask(newTask)
    newTaskIds.push(newTask.id)
    insertedTasks.push(newTask)
  }

  // Record in reverse chronological order so undo pops most recent first: paste last, bulk_delete (cut) before it.
  if (isCut) {
    await recordAction(userId, 'bulk_delete', {
      tasks: contents.tasks,
      directories: contents.directories,
    })
    for (const t of contents.tasks) {
      await deleteTask(userId, t.id)
      useTaskStore.getState().removeTask(t.id)
    }
    for (const d of contents.directories) {
      await deleteDirectory(userId, d.id)
      useDirectoryStore.getState().removeDirectory(d.id)
    }
    useClipboardStore.getState().clear()
  }
  await recordAction(userId, 'paste', { tasks: insertedTasks, directories: insertedDirs })

  return { newTaskIds, newDirectoryIds }
}
