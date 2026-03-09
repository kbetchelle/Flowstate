/**
 * Kanban view for a single column: tasks grouped by status.
 * Phase 8; same focus/selection for keyboard nav.
 */

import { forwardRef } from 'react'
import { MultiLineEntry } from './MultiLineEntry'
import type { ColumnItem } from './ColumnList'
import type { Task, TaskStatus } from '../types'

const STATUS_ORDER: TaskStatus[] = [
  'not_started',
  'in_progress',
  'finishing_touches',
  'completed',
]

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  finishing_touches: 'Finishing touches',
  completed: 'Completed',
}

export interface KanbanColumnProps {
  columnIndex: number
  items: ColumnItem[]
  tasks: Task[]
  directoryId: string | null
  userId: string | null
  focusedItemId: string | null
  selectedIds: string[]
  colorMode: 'none' | 'category' | 'priority'
  onItemClick: (id: string) => void
  onToggleComplete: (taskId: string) => void
}

function taskColor(task: Task, colorMode: 'none' | 'category' | 'priority'): string | undefined {
  if (colorMode === 'none') return undefined
  if (colorMode === 'priority') {
    if (task.priority === 'HIGH') return 'rgba(220, 53, 69, 0.2)'
    if (task.priority === 'MED') return 'rgba(255, 193, 7, 0.25)'
    if (task.priority === 'LOW') return 'rgba(40, 167, 69, 0.2)'
  }
  if (colorMode === 'category' && task.category) {
    const hue = (task.category.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360)
    return `hsla(${hue}, 50%, 90%, 0.9)`
  }
  return undefined
}

export const KanbanColumn = forwardRef<HTMLDivElement, KanbanColumnProps>(function KanbanColumn(
  {
    columnIndex,
    items,
    tasks,
    directoryId,
    userId,
    focusedItemId,
    selectedIds,
    colorMode,
    onItemClick,
    onToggleComplete,
  },
  ref
) {
  const dirItems = items.filter((it) => it.type === 'directory')
  const tasksByStatus = new Map<TaskStatus, Task[]>()
  for (const status of STATUS_ORDER) tasksByStatus.set(status, [])
  for (const t of tasks) {
    const list = tasksByStatus.get(t.status)
    if (list) list.push(t)
  }

  return (
    <div
      ref={ref}
      role="list"
      data-column-index={columnIndex}
      className="glass-panel"
      tabIndex={-1}
      style={{
        minWidth: 360,
        maxWidth: 480,
        padding: 8,
        overflowY: 'auto',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {dirItems.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {dirItems.map((item) => {
            const isFocused = focusedItemId === item.id
            const isSelected = selectedIds.includes(item.id)
            return (
              <div
                key={item.id}
                role="listitem"
                data-item-id={item.id}
                data-item-type="directory"
                tabIndex={isFocused ? 0 : -1}
                onClick={() => onItemClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: isSelected ? 'var(--highlight-bg-strong)' : isFocused ? 'var(--highlight-bg)' : undefined,
                  outline: 'none',
                }}
              >
                <span style={{ flexShrink: 0 }}>📁</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label || '(Untitled)'}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {STATUS_ORDER.map((status) => {
          const statusTasks = tasksByStatus.get(status) ?? []
          return (
            <div
              key={status}
              style={{
                flex: 1,
                minWidth: 100,
                borderRadius: 8,
                backgroundColor: 'var(--highlight-bg)',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {STATUS_LABELS[status]}
              </div>
              {statusTasks.map((task) => {
                const isFocused = focusedItemId === task.id
                const isSelected = selectedIds.includes(task.id)
                const bg = taskColor(task, colorMode)
                return (
                  <div
                    key={task.id}
                    role="listitem"
                    data-item-id={task.id}
                    data-item-type="task"
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => onItemClick(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault()
                        onToggleComplete(task.id)
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--highlight-bg-strong)' : isFocused ? 'var(--highlight-bg)' : bg ?? 'var(--surface-raised)',
                      outline: 'none',
                      fontSize: 13,
                      boxShadow: 'var(--glass-shadow)',
                      textDecoration: task.is_completed ? 'line-through' : undefined,
                      color: task.is_completed ? 'var(--text-tertiary)' : undefined,
                    }}
                  >
                    {task.title || '(Untitled)'}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {items.length === 0 && (
        <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 14 }}>directory empty</div>
      )}
      {userId && <MultiLineEntry directoryId={directoryId} userId={userId} />}
    </div>
  )
})
