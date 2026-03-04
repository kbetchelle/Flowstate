/**
 * Confirmation dialog for delete (Phase 9). Enter = confirm, Escape = cancel.
 */

import { useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useAppStore } from '../stores/appStore'
import { deleteTask } from '../api/tasks'
import { deleteDirectory } from '../api/directories'
import { recordAction } from '../lib/undo'
import { useFeedbackStore } from '../stores/feedbackStore'

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

  const open = pendingDeleteIds != null && pendingDeleteIds.length > 0
  const count = pendingDeleteIds?.length ?? 0

  const handleCancel = useCallback(() => {
    setPendingDeleteIds(null)
  }, [setPendingDeleteIds])

  const handleConfirm = useCallback(async () => {
    if (!userId || !pendingDeleteIds?.length) {
      setPendingDeleteIds(null)
      return
    }
    const tasksToDelete = tasks.filter((t) => pendingDeleteIds!.includes(t.id))
    const dirsToDelete = directories.filter((d) => pendingDeleteIds!.includes(d.id))
    try {
      await recordAction(userId, 'bulk_delete', {
        tasks: tasksToDelete,
        directories: dirsToDelete,
      })
      for (const t of tasksToDelete) {
        await deleteTask(userId, t.id)
        removeTask(t.id)
      }
      for (const d of dirsToDelete) {
        await deleteDirectory(userId, d.id)
        removeDirectory(d.id)
      }
      const hasTasks = tasksToDelete.length > 0
      const hasDirs = dirsToDelete.length > 0
      if (hasTasks && hasDirs) useFeedbackStore.getState().addToast('success', 'Items deleted')
      else if (hasTasks) useFeedbackStore.getState().addToast('success', tasksToDelete.length === 1 ? 'Task deleted' : 'Tasks deleted')
      else if (hasDirs) useFeedbackStore.getState().addToast('success', dirsToDelete.length === 1 ? 'Directory deleted' : 'Directories deleted')
    } catch {
      useFeedbackStore.getState().addToast('error', 'Delete failed')
    } finally {
      setFocusedItemId(null)
      setSelectedItems([])
      setPendingDeleteIds(null)
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
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxWidth: 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
          Delete {count} item{count !== 1 ? 's' : ''}?
        </h2>
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14 }}>
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
