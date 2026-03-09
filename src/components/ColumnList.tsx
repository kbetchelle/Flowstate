/**
 * Single column: list of directory and task rows with focus/selection styling.
 * Phase 6: inline naming (namingNewItemId), quick edit (inline rename on type/click).
 * Space toggles completion; no double-click for completion (spec).
 */

import { forwardRef, useState, useRef, useEffect } from 'react'
import { MultiLineEntry } from './MultiLineEntry'
import { useUIStore } from '../stores/uiStore'
import type { TaskPriority, TaskStatus } from '../types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  finishing_touches: 'Finishing touches',
  completed: 'Completed',
}

function DragHandleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  )
}

export interface ColumnItem {
  id: string
  type: 'directory' | 'task'
  label: string
  isCompleted?: boolean
  status?: TaskStatus
  category?: string | null
  priority?: TaskPriority
}

interface ColumnListProps {
  columnIndex: number
  items: ColumnItem[]
  focusedItemId: string | null
  selectedIds: string[]
  namingNewItemId: string | null
  directoryId: string | null
  userId: string | null
  colorMode: 'none' | 'category' | 'priority'
  onItemClick: (id: string) => void
  onToggleComplete: (taskId: string) => void
  onSaveTaskName: (taskId: string, title: string) => void
  onSaveDirectoryName: (directoryId: string, name: string) => void
  onClearNamingNewItemId: () => void
  onMoveItem?: (sourceId: string, sourceType: 'task' | 'directory', targetDirectoryId: string | null, insertAfterItemId: string | null) => void
}

function rowColor(item: ColumnItem, colorMode: 'none' | 'category' | 'priority'): string | undefined {
  if (colorMode === 'none' || item.type === 'directory') return undefined
  if (colorMode === 'priority' && item.priority) {
    if (item.priority === 'HIGH') return 'rgba(220, 53, 69, 0.2)'
    if (item.priority === 'MED') return 'rgba(255, 193, 7, 0.25)'
    if (item.priority === 'LOW') return 'rgba(40, 167, 69, 0.2)'
  }
  if (colorMode === 'category' && item.category) {
    const hue = (item.category.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360)
    return `hsla(${hue}, 50%, 90%, 0.9)`
  }
  return undefined
}

export const ColumnList = forwardRef<HTMLDivElement, ColumnListProps>(function ColumnList(
  {
    columnIndex,
    items,
    focusedItemId,
    selectedIds,
    namingNewItemId,
    directoryId,
    userId,
    colorMode,
    onItemClick,
    onToggleComplete,
    onSaveTaskName,
    onSaveDirectoryName,
    onClearNamingNewItemId,
    onMoveItem,
  },
  ref
) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const initialKeyRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDragging = useUIStore((s) => s.isDragging)
  const setDragging = useUIStore((s) => s.setDragging)
  const setDragSourceId = useUIStore((s) => s.setDragSourceId)

  const isNamingNew = (id: string) => id === namingNewItemId
  const isQuickEditing = (id: string) => id === editingItemId
  const isInlineEditing = (id: string) => isNamingNew(id) || isQuickEditing(id)

  useEffect(() => {
    const id = namingNewItemId ?? editingItemId
    if (id) {
      inputRef.current?.focus()
    }
  }, [namingNewItemId, editingItemId])

  const commitEdit = (id: string, type: 'directory' | 'task', value: string) => {
    const trimmed = value.trim()
    if (isNamingNew(id)) {
      if (type === 'task') onSaveTaskName(id, trimmed || '')
      else onSaveDirectoryName(id, trimmed || '')
      onClearNamingNewItemId()
    } else {
      if (type === 'task') onSaveTaskName(id, trimmed || '(Untitled)')
      else onSaveDirectoryName(id, trimmed || '(Untitled)')
      setEditingItemId(null)
    }
  }

  const cancelEdit = (id: string) => {
    if (isNamingNew(id)) {
      onClearNamingNewItemId()
    }
    setEditingItemId(null)
    initialKeyRef.current = null
  }

  const handleKeyDownOnRow = (e: React.KeyboardEvent, item: ColumnItem) => {
    if (isInlineEditing(item.id)) return
    const key = e.key
    if (key === '\\') return
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      initialKeyRef.current = key
      setEditingItemId(item.id)
    }
    if (key === 'Escape') {
      e.preventDefault()
      cancelEdit(item.id)
    }
  }

  const handleRowClick = (id: string) => {
    onItemClick(id)
  }

  return (
    <div
      ref={ref}
      role="list"
      data-column-index={columnIndex}
      className="glass-panel"
      tabIndex={-1}
      style={{
        minWidth: 220,
        maxWidth: 280,
        padding: 8,
        overflowY: 'auto',
        outline: 'none',
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 14 }}>
          directory empty
        </div>
      ) : (
        items.map((item) => {
          const isFocused = focusedItemId === item.id
          const isSelected = selectedIds.includes(item.id)
          const editing = isInlineEditing(item.id)
          const initialKey = editingItemId === item.id ? initialKeyRef.current : null
          const colorBg = rowColor(item, colorMode)

          const showHandle = !editing && (hoveredRowId === item.id || isDragging)
          const isDropTarget = dragOverItemId === item.id

          return (
            <div
              key={item.id}
              role="listitem"
              data-item-id={item.id}
              data-item-type={item.type}
              tabIndex={editing ? -1 : isFocused ? 0 : -1}
              onClick={() => handleRowClick(item.id)}
              onKeyDown={(e) => handleKeyDownOnRow(e, item)}
              onMouseEnter={() => setHoveredRowId(item.id)}
              onMouseLeave={() => {
                setHoveredRowId((prev) => (prev === item.id ? null : prev))
                if (dragOverItemId === item.id) setDragOverItemId(null)
              }}
              onDragOver={(e) => {
                if (!onMoveItem) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverItemId(item.id)
              }}
              onDragLeave={() => setDragOverItemId((prev) => (prev === item.id ? null : prev))}
              onDrop={(e) => {
                setDragOverItemId(null)
                setDragging(false)
                setDragSourceId(null)
                if (!onMoveItem) return
                e.preventDefault()
                const sourceId = e.dataTransfer.getData('application/x-flowstate-item-id')
                const sourceType = e.dataTransfer.getData('application/x-flowstate-item-type') as 'task' | 'directory' | ''
                if (sourceId && (sourceType === 'task' || sourceType === 'directory')) {
                  onMoveItem(sourceId, sourceType, directoryId, item.id)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                backgroundColor: isSelected ? 'var(--highlight-bg-strong)' : isFocused ? 'var(--highlight-bg)' : colorBg,
                outline: 'none',
                textDecoration: item.isCompleted ? 'line-through' : undefined,
                color: item.isCompleted ? 'var(--text-tertiary)' : undefined,
                border: isDropTarget ? '2px dashed var(--accent)' : undefined,
              }}
            >
              {showHandle && onMoveItem ? (
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragSourceId(item.id)
                    setDragging(true)
                    e.dataTransfer.setData('application/x-flowstate-item-id', item.id)
                    e.dataTransfer.setData('application/x-flowstate-item-type', item.type)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragging(false)
                    setDragSourceId(null)
                  }}
                  style={{
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-tertiary)',
                    padding: 2,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to move"
                >
                  <DragHandleIcon />
                </span>
              ) : (
                <span style={{ width: 12, flexShrink: 0 }} />
              )}
              {editing ? (
                <>
                  <span style={{ flexShrink: 0 }}>
                    {item.type === 'directory' ? '📁' : item.isCompleted ? '☑' : '☐'}
                  </span>
                  <input
                    ref={editing ? inputRef : undefined}
                    type="text"
                    defaultValue={
                      editingItemId === item.id && initialKey
                        ? initialKey
                        : isNamingNew(item.id)
                          ? ''
                          : item.label
                    }
                    placeholder={isNamingNew(item.id) ? 'Name...' : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitEdit(item.id, item.type, (e.target as HTMLInputElement).value)
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEdit(item.id)
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value
                      commitEdit(item.id, item.type, value)
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid var(--input-border)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </>
              ) : (
                <>
                  <span
                    style={{ flexShrink: 0, cursor: item.type === 'task' ? 'pointer' : undefined }}
                    role={item.type === 'task' ? 'button' : undefined}
                    tabIndex={item.type === 'task' ? -1 : undefined}
                    onClick={
                      item.type === 'task'
                        ? (e) => {
                            e.stopPropagation()
                            onToggleComplete(item.id)
                          }
                        : undefined
                    }
                    onKeyDown={
                      item.type === 'task'
                        ? (e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault()
                              e.stopPropagation()
                              onToggleComplete(item.id)
                            }
                          }
                        : undefined
                    }
                    aria-label={item.type === 'task' ? (item.isCompleted ? 'Mark incomplete' : 'Mark complete') : undefined}
                  >
                    {item.type === 'directory' ? '📁' : item.isCompleted ? '☑' : '☐'}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {item.label || '(Untitled)'}
                  </span>
                  {item.type === 'task' && item.status !== undefined && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        marginLeft: 6,
                      }}
                      aria-label={`Status: ${STATUS_LABELS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  )}
                </>
              )}
            </div>
          )
        })
      )}
      {userId && (
        <MultiLineEntry directoryId={directoryId} userId={userId} />
      )}
    </div>
  )
})
