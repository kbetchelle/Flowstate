/**
 * Confirmation dialog for delete (Phase 9). Enter = confirm, Escape = cancel.
 * Lists items being deleted and, if any, recursive (cascade) items in a dropdown.
 */

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useAppStore } from '../stores/appStore'
import { deleteTask } from '../api/tasks'
import { deleteDirectory } from '../api/directories'
import { recordAction } from '../lib/undo'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { Directory } from '../types'
import type { Task } from '../types'

function collectDescendantDirIds(
  dirIds: Set<string>,
  directories: Directory[]
): Set<string> {
  const current = new Set(dirIds)
  let prevSize = 0
  while (current.size !== prevSize) {
    prevSize = current.size
    for (const d of directories) {
      if (d.parent_id && current.has(d.parent_id)) current.add(d.id)
    }
  }
  return current
}

export function ConfirmDialog() {
  const pendingDeleteIds = useUIStore((s) => s.pendingDeleteIds)
  const setPendingDeleteIds = useUIStore((s) => s.setPendingDeleteIds)
  const userId = useAuthStore((s) => s.user?.id)
  const tasks = useTaskStore((s) => s.tasks)
  const directories = useDirectoryStore((s) => s.directories)
  const removeTask = useTaskStore((s) => s.removeTask)
  const removeDirectory = useDirectoryStore((s) => s.removeDirectory)
  const setFocusedItemId = useAppStore((s) => s.setFocusedItemId)
  const setSelectedItems = useAppStore((s) => s.setSelectedItems)
  const [recursiveExpanded, setRecursiveExpanded] = useState(false)

  const open = pendingDeleteIds != null && pendingDeleteIds.length > 0
  const count = pendingDeleteIds?.length ?? 0

  const { primaryNames, recursiveDirs, recursiveTasks } = useMemo(() => {
    if (!pendingDeleteIds?.length) {
      return {
        tasksToDelete: [] as Task[],
        dirsToDelete: [] as Directory[],
        primaryNames: [] as string[],
        recursiveDirs: [] as Directory[],
        recursiveTasks: [] as Task[],
      }
    }
    const tasksToDelete = tasks.filter((t) => pendingDeleteIds!.includes(t.id))
    const dirsToDelete = directories.filter((d) => pendingDeleteIds!.includes(d.id))
    const primaryNames = [
      ...dirsToDelete.map((d) => `📁 ${d.name || '(Untitled)'}`),
      ...tasksToDelete.map((t) => `☐ ${t.title || '(Untitled)'}`),
    ]
    const selectedDirIds = new Set(dirsToDelete.map((d) => d.id))
    const selectedTaskIds = new Set(tasksToDelete.map((t) => t.id))
    const allDirIdsInTree = collectDescendantDirIds(selectedDirIds, directories)
    const recursiveDirIds = new Set([...allDirIdsInTree].filter((id) => !selectedDirIds.has(id)))
    const dirIdsForTasks = new Set([...allDirIdsInTree])
    const recursiveTasks = tasks.filter(
      (t) => t.directory_id && dirIdsForTasks.has(t.directory_id) && !selectedTaskIds.has(t.id)
    )
    const recursiveDirs = directories.filter((d) => recursiveDirIds.has(d.id))
    return {
      primaryNames,
      recursiveDirs,
      recursiveTasks,
    }
  }, [pendingDeleteIds, tasks, directories])

  const handleCancel = useCallback(() => {
    setPendingDeleteIds(null)
    setRecursiveExpanded(false)
  }, [setPendingDeleteIds])

  const handleConfirm = useCallback(async () => {
    if (!userId || !pendingDeleteIds?.length) {
      setPendingDeleteIds(null)
      return
    }
    const tasksToDeleteLocal = tasks.filter((t) => pendingDeleteIds!.includes(t.id))
    const dirsToDeleteLocal = directories.filter((d) => pendingDeleteIds!.includes(d.id))
    try {
      await recordAction(userId, 'bulk_delete', {
        tasks: tasksToDeleteLocal,
        directories: dirsToDeleteLocal,
      })
      for (const t of tasksToDeleteLocal) {
        await deleteTask(userId, t.id)
        removeTask(t.id)
      }
      for (const d of dirsToDeleteLocal) {
        await deleteDirectory(userId, d.id)
        removeDirectory(d.id)
      }
      const hasTasks = tasksToDeleteLocal.length > 0
      const hasDirs = dirsToDeleteLocal.length > 0
      if (hasTasks && hasDirs) useFeedbackStore.getState().addToast('success', 'Items deleted')
      else if (hasTasks) useFeedbackStore.getState().addToast('success', tasksToDeleteLocal.length === 1 ? 'Task deleted' : 'Tasks deleted')
      else if (hasDirs) useFeedbackStore.getState().addToast('success', dirsToDeleteLocal.length === 1 ? 'Directory deleted' : 'Directories deleted')
    } catch {
      useFeedbackStore.getState().addToast('error', 'Delete failed')
    } finally {
      setFocusedItemId(null)
      setSelectedItems([])
      setPendingDeleteIds(null)
      setRecursiveExpanded(false)
    }
  }, [
    userId,
    pendingDeleteIds,
    tasks,
    directories,
    setPendingDeleteIds,
    setFocusedItemId,
    setSelectedItems,
    removeTask,
    removeDirectory,
  ])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void handleConfirm()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleConfirm, handleCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div
        className="glass-surface"
        style={{
          padding: 24,
          maxWidth: 400,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" style={{ margin: '0 0 12px', fontSize: 18 }}>
          Delete {count} item{count !== 1 ? 's' : ''}?
        </h2>
        {primaryNames.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Items to delete:</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text)' }}>
              {primaryNames.map((name, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {recursiveDirs.length + recursiveTasks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setRecursiveExpanded((e) => !e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 0',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
              aria-expanded={recursiveExpanded}
            >
              <span style={{ fontSize: 10 }}>{recursiveExpanded ? '▼' : '▶'}</span>
              Also deleting {recursiveDirs.length + recursiveTasks.length} item
              {recursiveDirs.length + recursiveTasks.length !== 1 ? 's' : ''} (cascade)
            </button>
            {recursiveExpanded && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                {recursiveDirs.map((d) => (
                  <li key={d.id} style={{ marginBottom: 2 }}>📁 {d.name || '(Untitled)'}</li>
                ))}
                {recursiveTasks.map((t) => (
                  <li key={t.id} style={{ marginBottom: 2 }}>☐ {t.title || '(Untitled)'}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
          Enter to confirm, Escape to cancel.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
