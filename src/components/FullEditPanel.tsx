/**
 * Full edit panel for task (spec §5 edit.full, §7, §9).
 * All task fields; open Cmd+Shift+E, close Escape. Attachments and URL in panel only.
 */

import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useTaskStore } from '../stores/taskStore'
import { useAuthStore } from '../stores/authStore'
import { fetchTask } from '../api/tasks'
import { runOrEnqueueTaskUpdate } from '../lib/offlineQueue'
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
} from '../api/attachments'
import { findConflictingFields } from '../api/conflictResolution'
import { useConflictStore } from '../stores/conflictStore'
import { useLinkStore } from '../stores/linkStore'
import { useAppStore } from '../stores/appStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import { createLink, deleteLink } from '../api/links'
import { wouldCreateDependencyCycle } from '../lib/dependencyCycle'
import type { Task, TaskPriority, TaskStatus, ChecklistItem, TaskLinkType } from '../types'

const PRIORITIES: TaskPriority[] = ['LOW', 'MED', 'HIGH']
const STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'finishing_touches', 'completed']

function taskToFormState(task: Task): Partial<Task> {
  return {
    title: task.title,
    due_date: task.due_date,
    start_date: task.start_date,
    priority: task.priority,
    status: task.status,
    description: task.description,
    checklist_items: task.checklist_items.map((c) => ({ ...c })),
    recurrence_frequency: task.recurrence_frequency,
    recurrence_interval: task.recurrence_interval,
    recurrence_end_date: task.recurrence_end_date,
    url: task.url,
    background_color: task.background_color,
    category: task.category,
    tags: task.tags,
    estimated_duration_minutes: task.estimated_duration_minutes,
    actual_duration_minutes: task.actual_duration_minutes,
    version: task.version,
  }
}

export function FullEditPanel() {
  const editPanelTaskId = useUIStore((s) => s.editPanelTaskId)
  const setEditPanelTaskId = useUIStore((s) => s.setEditPanelTaskId)
  const tasks = useTaskStore((s) => s.tasks)
  const userId = useAuthStore((s) => s.user?.id)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const task = editPanelTaskId ? tasks.find((t) => t.id === editPanelTaskId) : null
  const [form, setForm] = useState<Partial<Task>>({})
  const [attachments, setAttachments] = useState<{ name: string; path: string }[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [addLinkTargetId, setAddLinkTargetId] = useState<string | null>(null)
  const [addLinkType, setAddLinkType] = useState<TaskLinkType | null>(null)
  const [addLinkError, setAddLinkError] = useState<string | null>(null)
  const openConflict = useConflictStore((s) => s.openConflict)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const links = useLinkStore((s) => s.links)
  const addLink = useLinkStore((s) => s.addLink)
  const removeLink = useLinkStore((s) => s.removeLink)
  const setDependencyGraphOpen = useAppStore((s) => s.setDependencyGraphOpen)

  useEffect(() => {
    if (!editPanelTaskId || !userId) return
    const inStore = tasks.some((t) => t.id === editPanelTaskId)
    if (!inStore) {
      fetchTask(userId, editPanelTaskId).then((t) => {
        if (t) useTaskStore.getState().upsertTask(t)
      })
    }
  }, [editPanelTaskId, userId, tasks])

  useEffect(() => {
    if (task) {
      setForm(taskToFormState(task))
    }
  }, [task?.id, task?.version])

  useEffect(() => {
    if (!editPanelTaskId || !userId) return
    listAttachments(userId, editPanelTaskId).then(setAttachments)
  }, [editPanelTaskId, userId])

  useEffect(() => {
    if (attachments.length === 0) {
      setAttachmentUrls({})
      return
    }
    let cancelled = false
    const map: Record<string, string> = {}
    Promise.all(
      attachments.map(async (a) => {
        const url = await getAttachmentUrl(a.path)
        return { path: a.path, url }
      })
    ).then((results) => {
      if (cancelled) return
      results.forEach(({ path, url }) => {
        map[path] = url
      })
      setAttachmentUrls(map)
    })
    return () => {
      cancelled = true
    }
  }, [attachments])

  useEffect(() => {
    if (!editPanelTaskId) return
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="file"]), button, textarea, select, [tabindex="0"]'
    )
    firstFocusable?.focus()
  }, [editPanelTaskId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditPanelTaskId(null)
      return
    }
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.shiftKey && e.key === 'f') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const update = (patch: Partial<Task>) => setForm((f) => ({ ...f, ...patch }))

  const addChecklistItem = () => {
    const items = form.checklist_items ?? []
    const nextPos = items.length === 0 ? 0 : Math.max(...items.map((c) => c.position)) + 1
    update({
      checklist_items: [
        ...items,
        { id: crypto.randomUUID(), text: '', is_completed: false, position: nextPos },
      ],
    })
  }

  const updateChecklistItem = (id: string, patch: Partial<ChecklistItem>) => {
    const items = (form.checklist_items ?? []).map((c) =>
      c.id === id ? { ...c, ...patch } : c
    )
    update({ checklist_items: items })
  }

  const removeChecklistItem = (id: string) => {
    update({
      checklist_items: (form.checklist_items ?? []).filter((c) => c.id !== id),
    })
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !editPanelTaskId) return
    e.target.value = ''
    try {
      await uploadAttachment(userId, editPanelTaskId, file)
      const list = await listAttachments(userId, editPanelTaskId)
      setAttachments(list)
    } catch (_) {}
  }

  const onDeleteAttachment = async (path: string) => {
    try {
      await deleteAttachment(path)
      setAttachments((prev) => prev.filter((a) => a.path !== path))
    } catch (_) {}
  }

  const setTagsFromString = (s: string) => {
    const tags = s.split(',').map((t) => t.trim()).filter(Boolean)
    update({ tags })
  }

  const handleSave = async () => {
    if (!task || !userId) return
    const version = form.version ?? task.version
    const patch: Partial<Task> & { version: number } = {
      ...task,
      ...form,
      id: task.id,
      user_id: task.user_id,
      created_at: task.created_at,
      version,
      is_completed: (form.status ?? task.status) === 'completed',
    }
    setSaving(true)
    try {
      const localEntity = { ...task, ...form, is_completed: (form.status ?? task.status) === 'completed' } as Task
      const result = await runOrEnqueueTaskUpdate(userId, task.id, patch, localEntity)
      if ('queued' in result && result.queued) {
        upsertTask(localEntity)
        setForm(taskToFormState(localEntity))
      } else if ('ok' in result && result.ok) {
        upsertTask(result.task)
        setForm(taskToFormState(result.task))
        useFeedbackStore.getState().addToast('success', 'Task saved')
      } else {
        const r = result as { ok: false; serverVersion: number; serverTask: Task }
        const conflictingFields = findConflictingFields(localEntity, r.serverTask)
        openConflict({
          entityType: 'task',
          entityId: task.id,
          localVersion: version,
          serverVersion: r.serverVersion,
          conflictingFields,
          localEntity,
          serverEntity: r.serverTask,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editPanelTaskId) return null

  const formStyle = { marginBottom: 16 }
  const labelStyle = { display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid var(--input-border)',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  }

  return (
    <div
      ref={panelRef}
      data-full-edit-panel
      role="dialog"
      aria-label="Edit task"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 420,
        maxWidth: '100%',
        height: '100%',
        background: 'var(--surface-overlay)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        borderLeft: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Edit task</h2>
        <button
          type="button"
          onClick={() => setEditPanelTaskId(null)}
          aria-label="Close"
          style={{ padding: '4px 8px' }}
        >
          Close
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!task ? (
          <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : (
          <>
            <div style={formStyle}>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={form.title ?? ''}
                onChange={(e) => update({ title: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status ?? 'not_started'}
                onChange={(e) => update({ status: e.target.value as TaskStatus })}
                style={inputStyle}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Priority</label>
              <select
                value={form.priority ?? 'MED'}
                onChange={(e) => update({ priority: e.target.value as TaskPriority })}
                style={inputStyle}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Start date</label>
              <input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => update({ start_date: e.target.value || null })}
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Due date</label>
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => update({ due_date: e.target.value || null })}
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description ?? ''}
                onChange={(e) => update({ description: e.target.value })}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Checklist</label>
              {(form.checklist_items ?? []).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={(e) => updateChecklistItem(item.id, { is_completed: e.target.checked })}
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button type="button" onClick={() => removeChecklistItem(item.id)} aria-label="Remove">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addChecklistItem} style={{ marginTop: 4 }}>
                Add item
              </button>
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Recurrence</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={form.recurrence_frequency ?? ''}
                  onChange={(e) => update({ recurrence_frequency: e.target.value || null })}
                  style={{ ...inputStyle, flex: 1, minWidth: 100 }}
                >
                  <option value="">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <input
                  type="number"
                  placeholder="Interval"
                  value={form.recurrence_interval ?? ''}
                  onChange={(e) =>
                    update({
                      recurrence_interval: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  style={{ ...inputStyle, width: 80 }}
                />
                <input
                  type="date"
                  placeholder="End date"
                  value={form.recurrence_end_date ?? ''}
                  onChange={(e) => update({ recurrence_end_date: e.target.value || null })}
                  style={{ ...inputStyle, flex: 1, minWidth: 100 }}
                />
              </div>
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>URL</label>
              <input
                type="url"
                value={form.url ?? ''}
                onChange={(e) => update({ url: e.target.value || null })}
                style={inputStyle}
                placeholder="https://..."
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Attachments (Cmd+Shift+F to add)</label>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 8 }}>
                Add attachment
              </button>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {attachments.map((a) => {
                  const url = attachmentUrls[a.path]
                  return (
                    <li key={a.path} style={{ marginBottom: 4 }}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginRight: 8 }}
                        >
                          {a.name}
                        </a>
                      ) : (
                        <span style={{ marginRight: 8, color: 'var(--text-tertiary)' }}>{a.name}</span>
                      )}
                      <button type="button" onClick={() => onDeleteAttachment(a.path)} aria-label="Delete">
                        Delete
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Task links</label>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                <button
                  type="button"
                  onClick={() => setDependencyGraphOpen(true)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
                >
                  Open full Dependency Graph
                </button>
              </p>
              {editPanelTaskId && (() => {
                const taskLinks = links.filter(
                  (l) => l.source_id === editPanelTaskId || l.target_id === editPanelTaskId
                )
                const otherTaskId = (link: { source_id: string; target_id: string }) =>
                  link.source_id === editPanelTaskId ? link.target_id : link.source_id
                return (
                  <>
                    <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
                      {taskLinks.map((link) => {
                        const otherId = otherTaskId(link)
                        const otherTask = tasks.find((t) => t.id === otherId)
                        return (
                          <li key={link.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1 }}>
                              {otherTask?.title ?? otherId} ({link.link_type})
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!userId) return
                                try {
                                  await deleteLink(userId, link.id)
                                  removeLink(link.id)
                                } catch (_) {}
                              }}
                              aria-label="Remove link"
                              style={{ padding: '2px 8px', fontSize: 12 }}
                            >
                              Remove
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    {addLinkTargetId === null ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAddLinkTargetId('')
                          setAddLinkType(null)
                          setAddLinkError(null)
                        }}
                        style={{ marginTop: 4 }}
                      >
                        Add link
                      </button>
                    ) : (
                      <div style={{ marginTop: 8, padding: 8, border: '1px solid var(--divider)', borderRadius: 4 }}>
                        <label style={{ ...labelStyle, marginBottom: 4 }}>Task</label>
                        <select
                          value={addLinkTargetId}
                          onChange={(e) => setAddLinkTargetId(e.target.value || null)}
                          style={{ ...inputStyle, marginBottom: 8, width: '100%' }}
                        >
                          <option value="">Select task…</option>
                          {tasks
                            .filter((t) => t.id !== editPanelTaskId && !t.archived_at)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title || '(No title)'}
                              </option>
                            ))}
                        </select>
                        <label style={{ ...labelStyle, marginBottom: 4 }}>Type</label>
                        <select
                          value={addLinkType ?? ''}
                          onChange={(e) => setAddLinkType((e.target.value as TaskLinkType) || null)}
                          style={{ ...inputStyle, marginBottom: 8, width: '100%' }}
                        >
                          <option value="">Select type…</option>
                          <option value="reference">Reference</option>
                          <option value="dependency">Dependency</option>
                        </select>
                        {addLinkError && (
                          <p style={{ margin: '0 0 8px', color: 'var(--color-error)', fontSize: 13 }}>{addLinkError}</p>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!userId || !addLinkTargetId || !addLinkType) return
                              setAddLinkError(null)
                              if (addLinkType === 'dependency' && wouldCreateDependencyCycle(links, editPanelTaskId, addLinkTargetId)) {
                                setAddLinkError('This would create a circular dependency.')
                                return
                              }
                              try {
                                const created = await createLink(userId, editPanelTaskId, addLinkTargetId, addLinkType)
                                addLink(created)
                                setAddLinkTargetId(null)
                                setAddLinkType(null)
                              } catch (err) {
                                setAddLinkError(err instanceof Error ? err.message : 'Failed to add link')
                              }
                            }}
                            style={{ padding: '6px 12px' }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddLinkTargetId(null)
                              setAddLinkType(null)
                              setAddLinkError(null)
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Category</label>
              <input
                type="text"
                value={form.category ?? ''}
                onChange={(e) => update({ category: e.target.value || null })}
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input
                type="text"
                value={(form.tags ?? []).join(', ')}
                onChange={(e) => setTagsFromString(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Background color</label>
              <input
                type="text"
                value={form.background_color ?? ''}
                onChange={(e) => update({ background_color: e.target.value || null })}
                style={inputStyle}
                placeholder="#hex or name"
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Estimated duration (minutes)</label>
              <input
                type="number"
                value={form.estimated_duration_minutes ?? ''}
                onChange={(e) =>
                  update({
                    estimated_duration_minutes: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  })
                }
                style={inputStyle}
              />
            </div>
            <div style={formStyle}>
              <label style={labelStyle}>Actual duration (minutes)</label>
              <input
                type="number"
                value={form.actual_duration_minutes ?? ''}
                onChange={(e) =>
                  update({
                    actual_duration_minutes: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  })
                }
                style={inputStyle}
              />
            </div>
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
