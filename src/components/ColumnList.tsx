/**
 * Single column: list of directory and task rows with focus/selection styling.
 * Phase 6: inline naming (namingNewItemId), quick edit (inline rename on type/click).
 * Space toggles completion; no double-click for completion (spec).
 */

import { forwardRef, useState, useRef, useEffect } from 'react'
import { MultiLineEntry } from './MultiLineEntry'

export interface ColumnItem {
  id: string
  type: 'directory' | 'task'
  label: string
  isCompleted?: boolean
}

interface ColumnListProps {
  columnIndex: number
  items: ColumnItem[]
  focusedItemId: string | null
  selectedIds: string[]
  namingNewItemId: string | null
  directoryId: string | null
  userId: string | null
  onItemClick: (id: string) => void
  onToggleComplete: (taskId: string) => void
  onSaveTaskName: (taskId: string, title: string) => void
  onSaveDirectoryName: (directoryId: string, name: string) => void
  onClearNamingNewItemId: () => void
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
    onItemClick,
    onToggleComplete: _onToggleComplete,
    onSaveTaskName,
    onSaveDirectoryName,
    onClearNamingNewItemId,
  },
  ref
) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const initialKeyRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      tabIndex={-1}
      style={{
        minWidth: 220,
        maxWidth: 280,
        borderRight: '1px solid #e0e0e0',
        padding: 8,
        overflowY: 'auto',
        outline: 'none',
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: 12, color: '#999', fontSize: 14 }}>
          Empty
        </div>
      ) : (
        items.map((item) => {
          const isFocused = focusedItemId === item.id
          const isSelected = selectedIds.includes(item.id)
          const editing = isInlineEditing(item.id)
          const initialKey = editingItemId === item.id ? initialKeyRef.current : null

          return (
            <div
              key={item.id}
              role="listitem"
              data-item-id={item.id}
              data-item-type={item.type}
              tabIndex={editing ? -1 : isFocused ? 0 : -1}
              onClick={() => handleRowClick(item.id)}
              onKeyDown={(e) => handleKeyDownOnRow(e, item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : isFocused ? 'rgba(0,0,0,0.04)' : undefined,
                outline: 'none',
                textDecoration: item.isCompleted ? 'line-through' : undefined,
                color: item.isCompleted ? '#888' : undefined,
              }}
            >
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
                      border: '1px solid #ccc',
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
                  <span style={{ flexShrink: 0 }}>
                    {item.type === 'directory' ? '📁' : item.isCompleted ? '☑' : '☐'}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label || '(Untitled)'}
                  </span>
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
