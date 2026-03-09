/**
 * Multi-line entry: one line = one task (spec §6 Q40–Q41).
 * Free-form text, scrollable, left-aligned; Enter = new line = new task.
 */

import { useState, useRef } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { useUIStore } from '../stores/uiStore'
import { useFeedbackStore } from '../stores/feedbackStore'
import { insertTask } from '../api/tasks'
import { recordAction } from '../lib/undo'
import type { Task } from '../types'

const ROOT_TASK_MESSAGE = 'Tasks must live inside a directory. Please create the directory or move inside a directory to create a task'

interface MultiLineEntryProps {
  directoryId: string | null
  userId: string
}

const emptyTaskPayload = (directoryId: string | null, position: number): Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'> => ({
  title: '',
  directory_id: directoryId,
  priority: 'MED',
  start_date: null,
  due_date: null,
  background_color: null,
  category: null,
  tags: [],
  description: '',
  is_completed: false,
  completed_at: null,
  status: 'not_started',
  archived_at: null,
  archive_reason: null,
  position,
  recurrence_frequency: null,
  recurrence_interval: null,
  recurrence_end_date: null,
  checklist_items: [],
  estimated_duration_minutes: null,
  actual_duration_minutes: null,
  url: null,
  version: 1,
})

export function MultiLineEntry({ directoryId, userId }: MultiLineEntryProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const tasks = useTaskStore((s) => s.tasks)
  const setCreationContextActive = useUIStore((s) => s.setCreationContextActive)

  const getNextPosition = () => {
    const inDir = tasks.filter((t) => t.directory_id === directoryId)
    return inDir.length === 0 ? 0 : Math.max(...inDir.map((t) => t.position)) + 1
  }

  const createTaskForLine = async (title: string): Promise<boolean> => {
    if (directoryId === null) {
      useFeedbackStore.getState().addToast('error', ROOT_TASK_MESSAGE)
      return false
    }
    const position = getNextPosition()
    const task = await insertTask(userId, { ...emptyTaskPayload(directoryId, position), title })
    upsertTask(task)
    recordAction(userId, 'task_create', { task })
    return true
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    const ta = e.currentTarget
    const start = ta.selectionStart
    const text = ta.value
    const before = text.slice(0, start)
    const lineStart = before.lastIndexOf('\n') + 1
    const lineEnd = text.indexOf('\n', start)
    const line = (lineEnd === -1 ? text.slice(lineStart) : text.slice(lineStart, lineEnd)).trim()
    if (line) {
      e.preventDefault()
      createTaskForLine(line).then((created) => {
        if (created) {
          const newText = text.slice(0, start) + '\n' + text.slice(start)
          setValue(newText)
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1
            }
          })
        }
      })
    }
  }

  const handleBlur = async () => {
    const lines = value.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length > 0) {
      let created = 0
      for (const title of lines) {
        const ok = await createTaskForLine(title)
        if (ok) created++
      }
      if (created > 0) setValue('')
    }
    setCreationContextActive(false)
  }

  const handleFocus = () => {
    setCreationContextActive(true)
  }

  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid #eee', marginTop: 4 }}>
      <textarea
        ref={textareaRef}
        data-multi-line-entry
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="Add multiple tasks (one per line)..."
        rows={3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          padding: 8,
          fontSize: 14,
          border: '1px solid #e0e0e0',
          borderRadius: 4,
          outline: 'none',
          textAlign: 'left',
        }}
      />
    </div>
  )
}
