/**
 * Column-based drill-down: horizontal strip of columns with keyboard nav.
 * Spec §3, §5, §9. Phase 8: list / calendar / kanban per column.
 */

import { useRef, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useTaskStore } from '../stores/taskStore'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useViewStore } from '../stores/viewStore'
import { findConflictingFields } from '../api/conflictResolution'
import { useConflictStore } from '../stores/conflictStore'
import { runOrEnqueueTaskUpdate, runOrEnqueueDirectoryUpdate } from '../lib/offlineQueue'
import { getNextOccurrenceDates, hasRecurrence } from '../lib/recurrence'
import { insertTask } from '../api/tasks'
import { ColumnList, type ColumnItem } from './ColumnList'
import { CalendarColumn } from './CalendarColumn'
import { KanbanColumn } from './KanbanColumn'
import { useColumnKeyboard } from '../hooks/useColumnKeyboard'
import { recordAction } from '../lib/undo'
import type { Task, TaskStatus } from '../types'

const STATUS_ORDER: TaskStatus[] = [
  'not_started',
  'in_progress',
  'finishing_touches',
  'completed',
]

function taskDateKey(t: Task): string {
  const d = t.start_date || t.due_date || ''
  return d || '9999-12-31'
}

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
  const colorMode = useAppStore((s) => s.colorMode)
  const getViewType = useViewStore((s) => s.getViewType)

  const directories = useDirectoryStore((s) => s.directories)
  const tasks = useTaskStore((s) => s.tasks)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory)
  const userId = useAuthStore((s) => s.user?.id)
  const namingNewItemId = useUIStore((s) => s.namingNewItemId)
  const setNamingNewItemId = useUIStore((s) => s.setNamingNewItemId)
  const openConflict = useConflictStore((s) => s.openConflict)

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
    const viewType = getViewType(directoryId)
    const dirItems = childDirs.map((d) => ({
      id: d.id,
      type: 'directory' as const,
      label: d.name,
    }))
    const taskItem = (t: Task) => ({
      id: t.id,
      type: 'task' as const,
      label: t.title,
      isCompleted: t.is_completed,
      status: t.status,
      category: t.category,
      priority: t.priority,
    })
    if (viewType === 'calendar') {
      const sorted = [...dirTasks].sort((a, b) => taskDateKey(a).localeCompare(taskDateKey(b)))
      return [...dirItems, ...sorted.map(taskItem)]
    }
    if (viewType === 'kanban') {
      const sorted = [...dirTasks].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.position - b.position
      )
      return [...dirItems, ...sorted.map(taskItem)]
    }
    const sortedList = [...dirTasks].sort((a, b) => a.position - b.position)
    return [...dirItems, ...sortedList.map(taskItem)]
  })

  const tasksByColumnIndex: Task[][] = columnIds.map((directoryId) =>
    tasks
      .filter(
        (t) =>
          t.directory_id === directoryId &&
          !t.archived_at &&
          (showCompleted || !t.is_completed)
      )
      .sort((a, b) => a.position - b.position)
  )

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
      el?.scrollIntoView({ block: 'nearest' })
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
      const previous = { ...task }
      const completing = !task.is_completed
      const now = new Date().toISOString()
      const status: TaskStatus = completing ? 'completed' : 'not_started'
      const completed_at = completing ? now : null
      const patch = {
        ...task,
        is_completed: completing,
        status,
        completed_at,
        version: task.version,
      }
      const localEntity = { ...task, is_completed: completing, status, completed_at }
      runOrEnqueueTaskUpdate(userId, task.id, patch, localEntity).then((result) => {
        if ('queued' in result && result.queued) {
          upsertTask(localEntity)
        } else if ('ok' in result && result.ok) {
          const updated = result.task
          recordAction(userId, 'task_update', { taskId: task.id, previous, next: updated })
          upsertTask(updated)
          if (completing && hasRecurrence(updated)) {
            const nextDates = getNextOccurrenceDates(updated)
            if (nextDates) {
              const tasksInDir = tasks.filter(
                (t) => t.directory_id === updated.directory_id && !t.archived_at
              )
              const nextPosition =
                tasksInDir.length === 0 ? 0 : Math.max(...tasksInDir.map((t) => t.position)) + 1
              const checklistCopy = (updated.checklist_items ?? []).map((c, i) => ({
                ...c,
                id: crypto.randomUUID(),
                is_completed: false,
                position: i,
              }))
              const nextTask: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
                title: updated.title,
                directory_id: updated.directory_id,
                priority: updated.priority,
                start_date: nextDates.start_date,
                due_date: nextDates.due_date,
                description: updated.description ?? '',
                is_completed: false,
                completed_at: null,
                status: 'not_started',
                archived_at: null,
                archive_reason: null,
                position: nextPosition,
                recurrence_frequency: updated.recurrence_frequency,
                recurrence_interval: updated.recurrence_interval,
                recurrence_end_date: updated.recurrence_end_date,
                checklist_items: checklistCopy,
                estimated_duration_minutes: updated.estimated_duration_minutes,
                actual_duration_minutes: updated.actual_duration_minutes,
                url: updated.url,
                background_color: updated.background_color,
                category: updated.category,
                tags: [...(updated.tags ?? [])],
                version: 1,
              }
              insertTask(userId, nextTask).then((t) => {
                upsertTask(t)
                recordAction(userId, 'task_create', { task: t })
              })
            }
          }
        } else {
          const r = result as { ok: false; serverVersion: number; serverTask: Task }
          const conflictingFields = findConflictingFields(localEntity, r.serverTask)
          openConflict({
            entityType: 'task',
            entityId: task.id,
            localVersion: patch.version,
            serverVersion: r.serverVersion,
            conflictingFields,
            localEntity,
            serverEntity: r.serverTask,
          })
        }
      })
    }
  }

  const handleSaveTaskName = (taskId: string, title: string) => {
    if (!userId) return
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      const previous = { ...task }
      const patch = { ...task, title, version: task.version }
      const localEntity = { ...task, title }
      runOrEnqueueTaskUpdate(userId, task.id, patch, localEntity).then((result) => {
        if ('queued' in result && result.queued) {
          upsertTask(localEntity)
        } else if ('ok' in result && result.ok) {
          recordAction(userId, 'task_update', { taskId: task.id, previous, next: result.task })
          upsertTask(result.task)
        } else {
          const r = result as { ok: false; serverVersion: number; serverTask: Task }
          const conflictingFields = findConflictingFields(localEntity, r.serverTask)
          openConflict({
            entityType: 'task',
            entityId: task.id,
            localVersion: patch.version,
            serverVersion: r.serverVersion,
            conflictingFields,
            localEntity,
            serverEntity: r.serverTask,
          })
        }
      })
    }
    setNamingNewItemId(null)
  }

  const handleMoveItem = (
    sourceId: string,
    sourceType: 'task' | 'directory',
    targetDirectoryId: string | null,
    _insertAfterItemId: string | null
  ) => {
    if (!userId) return
    const tasks = useTaskStore.getState().tasks
    const directories = useDirectoryStore.getState().directories
    const targetTasks = tasks.filter((t) => t.directory_id === targetDirectoryId && !t.archived_at)
    const targetDirs = directories.filter((d) => d.parent_id === targetDirectoryId)
    const maxTaskPos = targetTasks.length === 0 ? -1 : Math.max(...targetTasks.map((t) => t.position))
    const maxDirPos = targetDirs.length === 0 ? -1 : Math.max(...targetDirs.map((d) => d.position))
    if (sourceType === 'task') {
      const task = tasks.find((t) => t.id === sourceId)
      if (task) {
        const newPos = maxTaskPos + 1
        const patch = { ...task, directory_id: targetDirectoryId, position: newPos, version: task.version }
        const localEntity = { ...task, directory_id: targetDirectoryId, position: newPos }
        runOrEnqueueTaskUpdate(userId, task.id, patch, localEntity).then((result) => {
          if ('queued' in result && result.queued) upsertTask(localEntity)
          else if ('ok' in result && result.ok) upsertTask(result.task)
          else {
            const r = result as { ok: false; serverVersion: number; serverTask: Task }
            openConflict({
              entityType: 'task',
              entityId: task.id,
              localVersion: patch.version,
              serverVersion: r.serverVersion,
              conflictingFields: findConflictingFields(localEntity, r.serverTask),
              localEntity,
              serverEntity: r.serverTask,
            })
          }
        })
      }
    } else {
      const dir = directories.find((d) => d.id === sourceId)
      if (dir) {
        const parent = targetDirectoryId ? directories.find((d) => d.id === targetDirectoryId) : null
        const newPos = maxDirPos + 1
        const depthLevel = parent ? parent.depth_level + 1 : 0
        const patch = { ...dir, parent_id: targetDirectoryId, position: newPos, depth_level: depthLevel, version: dir.version }
        const localEntity = { ...dir, parent_id: targetDirectoryId, position: newPos, depth_level: depthLevel }
        runOrEnqueueDirectoryUpdate(userId, dir.id, patch, localEntity).then((result) => {
          if ('queued' in result && result.queued) upsertDirectory(localEntity)
          else if ('ok' in result && result.ok) upsertDirectory(result.directory)
          else {
            const r = result as { ok: false; serverVersion: number; serverDirectory: import('../types').Directory }
            openConflict({
              entityType: 'directory',
              entityId: dir.id,
              localVersion: dir.version,
              serverVersion: r.serverVersion,
              conflictingFields: findConflictingFields(localEntity, r.serverDirectory),
              localEntity,
              serverEntity: r.serverDirectory,
            })
          }
        })
      }
    }
  }

  const handleSaveDirectoryName = (directoryId: string, name: string) => {
    if (!userId) return
    const dir = directories.find((d) => d.id === directoryId)
    if (dir) {
      const previous = { ...dir }
      const patch = { ...dir, name, version: dir.version }
      const localEntity = { ...dir, name }
      runOrEnqueueDirectoryUpdate(userId, dir.id, patch, localEntity).then((result) => {
        if ('queued' in result && result.queued) {
          upsertDirectory(localEntity)
        } else if ('ok' in result && result.ok) {
          recordAction(userId, 'directory_update', { directoryId: dir.id, previous, next: result.directory })
          upsertDirectory(result.directory)
        } else {
          const r = result as { ok: false; serverVersion: number; serverDirectory: import('../types').Directory }
          const conflictingFields = findConflictingFields(localEntity, r.serverDirectory)
          openConflict({
            entityType: 'directory',
            entityId: dir.id,
            localVersion: dir.version,
            serverVersion: r.serverVersion,
            conflictingFields,
            localEntity,
            serverEntity: r.serverDirectory,
          })
        }
      })
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
        const columnTasks = tasksByColumnIndex[i] ?? []
        const isFocusedColumn = i === focusedColumnIndex
        const viewType = getViewType(directoryId)
        const refAssign = (el: HTMLDivElement | null) => {
          columnContainerRefs.current[i] = el
        }
        if (viewType === 'calendar') {
          return (
            <CalendarColumn
              key={i}
              ref={refAssign}
              columnIndex={i}
              items={items}
              tasks={columnTasks}
              directoryId={directoryId}
              userId={userId ?? null}
              focusedItemId={isFocusedColumn ? focusedItemId : null}
              selectedIds={isFocusedColumn ? selectedItems : []}
              colorMode={colorMode}
              onItemClick={handleItemClick}
              onToggleComplete={handleToggleComplete}
            />
          )
        }
        if (viewType === 'kanban') {
          return (
            <KanbanColumn
              key={i}
              ref={refAssign}
              columnIndex={i}
              items={items}
              tasks={columnTasks}
              directoryId={directoryId}
              userId={userId ?? null}
              focusedItemId={isFocusedColumn ? focusedItemId : null}
              selectedIds={isFocusedColumn ? selectedItems : []}
              colorMode={colorMode}
              onItemClick={handleItemClick}
              onToggleComplete={handleToggleComplete}
            />
          )
        }
        return (
          <ColumnList
            key={i}
            ref={refAssign}
            columnIndex={i}
            items={items}
            focusedItemId={isFocusedColumn ? focusedItemId : null}
            selectedIds={isFocusedColumn ? selectedItems : []}
            namingNewItemId={isFocusedColumn ? namingNewItemId : null}
            directoryId={directoryId}
            userId={userId ?? null}
            colorMode={colorMode}
            onItemClick={handleItemClick}
            onToggleComplete={handleToggleComplete}
            onSaveTaskName={handleSaveTaskName}
            onSaveDirectoryName={handleSaveDirectoryName}
            onClearNamingNewItemId={() => setNamingNewItemId(null)}
            onMoveItem={handleMoveItem}
          />
        )
      })}
    </div>
  )
}
