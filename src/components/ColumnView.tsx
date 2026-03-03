/**
 * Column-based drill-down: horizontal strip of columns with keyboard nav.
 * Spec §3, §5, §9.
 */

import { useRef, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useTaskStore } from '../stores/taskStore'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { updateTask } from '../api/tasks'
import { updateDirectory } from '../api/directories'
import { ColumnList, type ColumnItem } from './ColumnList'
import { useColumnKeyboard } from '../hooks/useColumnKeyboard'

export function ColumnView() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const columnContainerRefs = useRef<(HTMLDivElement | null)[]>([])
  const columnItemsRef = useRef<ColumnItem[][]>([])

  const navigationPath = useAppStore((s) => s.navigationPath)
  const focusedItemId = useAppStore((s) => s.focusedItemId)
  const focusedColumnIndex = useAppStore((s) => s.focusedColumnIndex)
  const selectedItems = useAppStore((s) => s.selectedItems)
  const setFocusedItemId = useAppStore((s) => s.setFocusedItemId)
  const setSelectedItems = useAppStore((s) => s.setSelectedItems)
  const showCompleted = useAppStore((s) => s.showCompleted)

  const directories = useDirectoryStore((s) => s.directories)
  const tasks = useTaskStore((s) => s.tasks)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory)
  const userId = useAuthStore((s) => s.user?.id)
  const namingNewItemId = useUIStore((s) => s.namingNewItemId)
  const setNamingNewItemId = useUIStore((s) => s.setNamingNewItemId)

  const columnIds: (string | null)[] = [null, ...navigationPath]
  const columnCount = columnIds.length

  const columnItemsByIndex: ColumnItem[][] = columnIds.map((directoryId) => {
    const childDirs = directories
      .filter((d) => d.parent_id === directoryId)
      .sort((a, b) => a.position - b.position)
    const dirTasks = tasks
      .filter(
        (t) =>
          t.directory_id === directoryId &&
          !t.archived_at &&
          (showCompleted || !t.is_completed)
      )
      .sort((a, b) => a.position - b.position)
    return [
      ...childDirs.map((d) => ({
        id: d.id,
        type: 'directory' as const,
        label: d.name,
      })),
      ...dirTasks.map((t) => ({
        id: t.id,
        type: 'task' as const,
        label: t.title,
        isCompleted: t.is_completed,
      })),
    ]
  })

  columnItemsRef.current = columnItemsByIndex
  columnContainerRefs.current = columnContainerRefs.current.slice(0, columnCount)

  useColumnKeyboard(
    scrollContainerRef,
    columnContainerRefs,
    columnItemsRef,
    columnCount
  )

  useEffect(() => {
    const colIndex = Math.min(focusedColumnIndex, columnCount - 1)
    const container = columnContainerRefs.current[colIndex]
    if (!container) return
    const active = document.activeElement as HTMLElement | null
    const focusIsInColumnInput = container.contains(active) && active?.tagName === 'INPUT'
    if (focusIsInColumnInput) return
    if (focusedItemId && focusedItemId !== namingNewItemId) {
      const el = container.querySelector(`[data-item-id="${focusedItemId}"]`) as HTMLElement | null
      el?.focus()
    } else if (!focusedItemId) {
      container.focus()
    }
  }, [focusedColumnIndex, focusedItemId, namingNewItemId, columnCount])

  const handleItemClick = (id: string) => {
    setFocusedItemId(id)
    setSelectedItems([id])
  }

  const handleToggleComplete = (taskId: string) => {
    if (!userId) return
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      updateTask(userId, task.id, {
        ...task,
        is_completed: !task.is_completed,
        version: task.version,
      }).then(upsertTask)
    }
  }

  const handleSaveTaskName = (taskId: string, title: string) => {
    if (!userId) return
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      updateTask(userId, task.id, { ...task, title, version: task.version }).then(upsertTask)
    }
    setNamingNewItemId(null)
  }

  const handleSaveDirectoryName = (directoryId: string, name: string) => {
    if (!userId) return
    const dir = directories.find((d) => d.id === directoryId)
    if (dir) {
      updateDirectory(userId, dir.id, { ...dir, name, version: dir.version }).then(upsertDirectory)
    }
    setNamingNewItemId(null)
  }

  return (
    <div
      ref={scrollContainerRef}
      role="region"
      aria-label="Columns"
      tabIndex={-1}
      style={{
        display: 'flex',
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        outline: 'none',
      }}
    >
      {columnIds.map((directoryId, i) => {
        const items = columnItemsByIndex[i] ?? []
        const isFocusedColumn = i === focusedColumnIndex
        return (
          <ColumnList
            key={i}
            ref={(el) => {
              columnContainerRefs.current[i] = el
            }}
            columnIndex={i}
            items={items}
            focusedItemId={isFocusedColumn ? focusedItemId : null}
            selectedIds={isFocusedColumn ? selectedItems : []}
            namingNewItemId={isFocusedColumn ? namingNewItemId : null}
            directoryId={directoryId}
            userId={userId ?? null}
            onItemClick={handleItemClick}
            onToggleComplete={handleToggleComplete}
            onSaveTaskName={handleSaveTaskName}
            onSaveDirectoryName={handleSaveDirectoryName}
            onClearNamingNewItemId={() => setNamingNewItemId(null)}
          />
        )
      })}
    </div>
  )
}
