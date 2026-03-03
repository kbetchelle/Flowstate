/**
 * Calendar view for a single column: tasks placed by start_date / due_date.
 * Phase 8; same focus/selection as ColumnList for keyboard nav.
 */

import { forwardRef } from 'react'
import { MultiLineEntry } from './MultiLineEntry'
import type { ColumnItem } from './ColumnList'
import type { Task } from '../types'

function getTaskDate(t: Task): string {
  const d = t.start_date || t.due_date || ''
  return d || '9999-12-31'
}

function getMonthKey(dateStr: string): string {
  if (dateStr === '9999-12-31') return 'no-date'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface CalendarColumnProps {
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

function itemColor(item: ColumnItem, colorMode: 'none' | 'category' | 'priority', task?: Task): string | undefined {
  if (colorMode === 'none' || item.type === 'directory') return undefined
  if (colorMode === 'priority' && task) {
    if (task.priority === 'HIGH') return 'rgba(220, 53, 69, 0.2)'
    if (task.priority === 'MED') return 'rgba(255, 193, 7, 0.25)'
    if (task.priority === 'LOW') return 'rgba(40, 167, 69, 0.2)'
  }
  if (colorMode === 'category' && task?.category) {
    const hue = (task.category.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360)
    return `hsla(${hue}, 50%, 90%, 0.9)`
  }
  return undefined
}

export const CalendarColumn = forwardRef<HTMLDivElement, CalendarColumnProps>(function CalendarColumn(
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
  const tasksByMonth = new Map<string, Task[]>()
  const noDate: Task[] = []
  for (const t of tasks) {
    const key = getMonthKey(getTaskDate(t))
    if (key === 'no-date') noDate.push(t)
    else {
      if (!tasksByMonth.has(key)) tasksByMonth.set(key, [])
      tasksByMonth.get(key)!.push(t)
    }
  }
  const sortedMonths = Array.from(tasksByMonth.keys()).sort()
  const dirItems = items.filter((it) => it.type === 'directory')

  return (
    <div
      ref={ref}
      role="list"
      data-column-index={columnIndex}
      tabIndex={-1}
      style={{
        minWidth: 320,
        maxWidth: 400,
        borderRight: '1px solid #e0e0e0',
        padding: 8,
        overflowY: 'auto',
        outline: 'none',
      }}
    >
      {dirItems.length > 0 && (
        <div style={{ marginBottom: 12 }}>
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
                  backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : isFocused ? 'rgba(0,0,0,0.04)' : undefined,
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
      {sortedMonths.map((monthKey) => {
        const monthTasks = tasksByMonth.get(monthKey)!.sort(
          (a, b) => getTaskDate(a).localeCompare(getTaskDate(b))
        )
        const [year, month] = monthKey.split('-').map(Number)
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
          month: 'short',
          year: 'numeric',
        })
        return (
          <div key={monthKey} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
              {monthLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {monthTasks.map((task) => {
                const isFocused = focusedItemId === task.id
                const isSelected = selectedIds.includes(task.id)
                const bg = itemColor(
                  { id: task.id, type: 'task', label: task.title, isCompleted: task.is_completed },
                  colorMode,
                  task
                )
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
                      padding: '6px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : isFocused ? 'rgba(0,0,0,0.04)' : bg,
                      outline: 'none',
                      fontSize: 13,
                      textDecoration: task.is_completed ? 'line-through' : undefined,
                      color: task.is_completed ? '#888' : undefined,
                    }}
                  >
                    {task.due_date && (
                      <span style={{ fontSize: 11, color: '#888', marginRight: 6 }}>
                        {new Date(task.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {task.title || '(Untitled)'}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {noDate.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>No date</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {noDate.map((task) => {
              const isFocused = focusedItemId === task.id
              const isSelected = selectedIds.includes(task.id)
              const bg = itemColor(
                { id: task.id, type: 'task', label: task.title, isCompleted: task.is_completed },
                colorMode,
                task
              )
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
                    padding: '6px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : isFocused ? 'rgba(0,0,0,0.04)' : bg,
                    outline: 'none',
                    fontSize: 13,
                    textDecoration: task.is_completed ? 'line-through' : undefined,
                    color: task.is_completed ? '#888' : undefined,
                  }}
                >
                  {task.title || '(Untitled)'}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {items.length === 0 && (
        <div style={{ padding: 12, color: '#999', fontSize: 14 }}>Empty</div>
      )}
      {userId && <MultiLineEntry directoryId={directoryId} userId={userId} />}
    </div>
  )
})
