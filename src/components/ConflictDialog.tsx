/**
 * Conflict resolution dialog: choose mine/theirs per field (spec §4, Q54).
 * No last-write-wins; user must resolve via this dialog.
 */

import { useEffect, useState } from 'react'
import { useConflictStore } from '../stores/conflictStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { resolveWithVersion } from '../api/conflictResolution'
import { updateWithConflictCheck } from '../api/tasks'
import { useFeedbackStore } from '../stores/feedbackStore'
import { updateDirectoryWithConflictCheck } from '../api/directories'
import type { Task } from '../types'
import type { Directory } from '../types'

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return JSON.stringify(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function ConflictDialog() {
  const open = useConflictStore((s) => s.open)
  const entityType = useConflictStore((s) => s.entityType)
  const entityId = useConflictStore((s) => s.entityId)
  const conflictingFields = useConflictStore((s) => s.conflictingFields)
  const localEntity = useConflictStore((s) => s.localEntity)
  const serverEntity = useConflictStore((s) => s.serverEntity)
  const closeConflict = useConflictStore((s) => s.closeConflict)
  const openConflict = useConflictStore((s) => s.openConflict)
  const onAfterResolved = useConflictStore((s) => s.onAfterResolved)
  const setOnAfterResolved = useConflictStore((s) => s.setOnAfterResolved)

  const userId = useAuthStore((s) => s.user?.id)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory)

  const fieldKeys = Object.keys(conflictingFields)
  const [choices, setChoices] = useState<Record<string, 'mine' | 'theirs'>>({})
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (!open) return
    const initial: Record<string, 'mine' | 'theirs'> = {}
    fieldKeys.forEach((k) => {
      initial[k] = 'mine'
    })
    setChoices(initial)
  }, [open, fieldKeys.join(',')])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeConflict()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeConflict])

  const setChoice = (field: string, value: 'mine' | 'theirs') => {
    setChoices((c) => ({ ...c, [field]: value }))
  }

  const useMineForAll = () => {
    const next: Record<string, 'mine' | 'theirs'> = {}
    fieldKeys.forEach((k) => {
      next[k] = 'mine'
    })
    setChoices(next)
  }

  const useTheirsForAll = () => {
    const next: Record<string, 'mine' | 'theirs'> = {}
    fieldKeys.forEach((k) => {
      next[k] = 'theirs'
    })
    setChoices(next)
  }

  const handleResolve = async () => {
    if (!userId || !entityId || !localEntity || !serverEntity || entityType === null) return
    setResolving(true)
    try {
      const merged =
        entityType === 'task'
          ? resolveWithVersion(
              localEntity as Task,
              serverEntity as Task,
              choices
            )
          : resolveWithVersion(
              localEntity as Directory,
              serverEntity as Directory,
              choices
            )

      if (entityType === 'task') {
        const task = merged as Task
        const serverTask = serverEntity as Task
        const patch: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>> & { version: number } = {
          ...task,
          version: serverTask.version,
        }
        const result = await updateWithConflictCheck(userId, entityId, patch)
        if (result.ok) {
          upsertTask(result.task)
          closeConflict()
          useFeedbackStore.getState().addToast('success', 'Conflict resolved')
          onAfterResolved?.()
          setOnAfterResolved(null)
        } else {
          const { findConflictingFields } = await import('../api/conflictResolution')
          const localEntity2 = task
          const conflictingFields2 = findConflictingFields(localEntity2, result.serverTask)
          openConflict({
            entityType: 'task',
            entityId,
            localVersion: task.version,
            serverVersion: result.serverVersion,
            conflictingFields: conflictingFields2,
            localEntity: localEntity2,
            serverEntity: result.serverTask,
          })
        }
      } else {
        const dir = merged as Directory
        const serverDir = serverEntity as Directory
        const patch: Partial<Omit<Directory, 'id' | 'user_id' | 'created_at'>> & { version: number } = {
          ...dir,
          version: serverDir.version,
        }
        const result = await updateDirectoryWithConflictCheck(userId, entityId, patch)
        if (result.ok) {
          upsertDirectory(result.directory)
          closeConflict()
          useFeedbackStore.getState().addToast('success', 'Conflict resolved')
          onAfterResolved?.()
          setOnAfterResolved(null)
        } else {
          const { findConflictingFields } = await import('../api/conflictResolution')
          const localEntity2 = dir
          const conflictingFields2 = findConflictingFields(localEntity2, result.serverDirectory)
          openConflict({
            entityType: 'directory',
            entityId,
            localVersion: dir.version,
            serverVersion: result.serverVersion,
            conflictingFields: conflictingFields2,
            localEntity: localEntity2,
            serverEntity: result.serverDirectory,
          })
        }
      }
    } finally {
      setResolving(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && closeConflict()}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #fff)',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxWidth: 480,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="conflict-dialog-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
          Conflict — {entityType === 'task' ? 'Task' : 'Directory'} was changed elsewhere
        </h2>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: 14 }}>
          Choose which version to keep for each field. Then click Resolve to save.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={useMineForAll}
            style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            Use mine for all
          </button>
          <button
            type="button"
            onClick={useTheirsForAll}
            style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            Use theirs for all
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          {fieldKeys.map((field) => {
            const { local, server } = conflictingFields[field]
            const choice = choices[field] ?? 'mine'
            return (
              <div
                key={field}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, textTransform: 'capitalize' }}>
                  {field.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  <strong>Mine:</strong> {formatValue(local)}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  <strong>Theirs:</strong> {formatValue(server)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setChoice(field, 'mine')}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: choice === 'mine' ? 600 : 400,
                    }}
                  >
                    Use mine
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoice(field, 'theirs')}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: choice === 'theirs' ? 600 : 400,
                    }}
                  >
                    Use theirs
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
          Escape to cancel.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={closeConflict}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolving}
            style={{ padding: '8px 16px', cursor: resolving ? 'wait' : 'pointer' }}
          >
            {resolving ? 'Saving…' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  )
}
