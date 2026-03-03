/**
 * Single column: list of directory and task rows with focus/selection styling.
 * Phase 4: list only; Phase 8 adds calendar/kanban.
 */

import { forwardRef } from 'react'

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
  onItemClick: (id: string) => void
  onToggleComplete: (taskId: string) => void
}

export const ColumnList = forwardRef<HTMLDivElement, ColumnListProps>(function ColumnList(
  {
    columnIndex,
    items,
    focusedItemId,
    selectedIds,
    onItemClick,
    onToggleComplete,
  },
  ref
) {
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
          return (
            <div
              key={item.id}
              role="listitem"
              data-item-id={item.id}
              data-item-type={item.type}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => onItemClick(item.id)}
              onDoubleClick={() => item.type === 'task' && onToggleComplete(item.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                backgroundColor: isSelected ? 'rgba(0,0,0,0.06)' : isFocused ? 'rgba(0,0,0,0.04)' : undefined,
                outline: 'none',
                textDecoration: item.isCompleted ? 'line-through' : undefined,
                color: item.isCompleted ? '#888' : undefined,
              }}
            >
              <span style={{ marginRight: 8 }}>
                {item.type === 'directory' ? '📁' : item.isCompleted ? '☑' : '☐'}
              </span>
              {item.label || '(Untitled)'}
            </div>
          )
        })
      )}
    </div>
  )
})
