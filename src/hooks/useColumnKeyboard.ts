/**
 * Keyboard navigation for column view: arrows, selection, scroll, Home/End.
 * Spec §5 contextual nav.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useUIStore } from '../stores/uiStore'
import { insertTask } from '../api/tasks'
import { insertDirectory } from '../api/directories'
import { runOrEnqueueTaskUpdate, runOrEnqueueDirectoryUpdate } from '../lib/offlineQueue'
import { getNextOccurrenceDates, hasRecurrence } from '../lib/recurrence'
import { findConflictingFields } from '../api/conflictResolution'
import { useConflictStore } from '../stores/conflictStore'
import { copySelection, cutSelection, copyRecursive, paste } from '../lib/clipboard'
import { recordAction } from '../lib/undo'
import { useFeedbackStore } from '../stores/feedbackStore'
import type { ColumnItem } from '../components/ColumnList'
import type { Task } from '../types'

export function useColumnKeyboard(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  _columnContainerRefsRef: React.MutableRefObject<(HTMLDivElement | null)[]>,
  columnItemsRef: React.MutableRefObject<ColumnItem[][]>,
  columnCount: number
) {
  const navigationPath = useAppStore((s) => s.navigationPath)
  const setNavigationPath = useAppStore((s) => s.setNavigationPath)
  const focusedItemId = useAppStore((s) => s.focusedItemId)
  const setFocusedItemId = useAppStore((s) => s.setFocusedItemId)
  const focusedColumnIndex = useAppStore((s) => s.focusedColumnIndex)
  const setFocusedColumnIndex = useAppStore((s) => s.setFocusedColumnIndex)
  const setSelectedItems = useAppStore((s) => s.setSelectedItems)
  const selectionAnchorId = useAppStore((s) => s.selectionAnchorId)
  const setSelectionAnchorId = useAppStore((s) => s.setSelectionAnchorId)

  const userId = useAuthStore((s) => s.user?.id)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory)
  const setNamingNewItemId = useUIStore((s) => s.setNamingNewItemId)
  const setPendingDeleteIds = useUIStore((s) => s.setPendingDeleteIds)
  const grabModeActive = useUIStore((s) => s.grabModeActive)
  const setGrabModeActive = useUIStore((s) => s.setGrabModeActive)
  const setGrabDropTargetId = useUIStore((s) => s.setGrabDropTargetId)

  const isInputFocused = useRef(false)

  useEffect(() => {
    if (grabModeActive) setGrabDropTargetId(focusedItemId)
  }, [grabModeActive, focusedItemId, setGrabDropTargetId])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as Node
      if (!container.contains(target)) return
      const activeEl = document.activeElement
      if (activeEl?.closest?.('input, textarea, [contenteditable="true"]')) {
        isInputFocused.current = true
        return
      }
      isInputFocused.current = false

      const items = columnItemsRef.current
      const colIndex = Math.min(focusedColumnIndex, columnCount - 1)
      const columnItems = items[colIndex] ?? []

      const focusIndex = columnItems.findIndex((it) => it.id === focusedItemId)
      const mod = e.metaKey || e.ctrlKey

      if (grabModeActive) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setGrabModeActive(false)
          setGrabDropTargetId(null)
          return
        }
        if (e.key === 'Enter' && userId) {
          e.preventDefault()
          const selectedIds = useAppStore.getState().selectedItems
          const toMove = selectedIds.length > 0 ? selectedIds : (focusedItemId ? [focusedItemId] : [])
          const targetDirectoryId = colIndex === 0 ? null : navigationPath[colIndex - 1] ?? null
          const tasks = useTaskStore.getState().tasks
          const directories = useDirectoryStore.getState().directories
          const targetTasks = tasks.filter((t) => t.directory_id === targetDirectoryId && !t.archived_at)
          const targetDirs = directories.filter((d) => d.parent_id === targetDirectoryId)
          const maxTaskPos = targetTasks.length === 0 ? -1 : Math.max(...targetTasks.map((t) => t.position))
          const maxDirPos = targetDirs.length === 0 ? -1 : Math.max(...targetDirs.map((d) => d.position))
          let nextTaskPos = maxTaskPos + 1
          let nextDirPos = maxDirPos + 1
          toMove.forEach((id) => {
            const task = tasks.find((t) => t.id === id)
            const dir = directories.find((d) => d.id === id)
            if (task) {
              const patch = {
                ...task,
                directory_id: targetDirectoryId,
                position: nextTaskPos++,
                version: task.version,
              }
              const localEntity = { ...task, directory_id: targetDirectoryId, position: patch.position }
              runOrEnqueueTaskUpdate(userId, task.id, patch, localEntity).then((result) => {
                if ('queued' in result && result.queued) upsertTask(localEntity)
                else if ('ok' in result && result.ok) upsertTask(result.task)
                else {
                  const r = result as { ok: false; serverVersion: number; serverTask: Task }
                  useConflictStore.getState().openConflict({
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
            } else if (dir) {
              const parent = targetDirectoryId ? directories.find((d) => d.id === targetDirectoryId) : null
              const patch = {
                ...dir,
                parent_id: targetDirectoryId,
                position: nextDirPos++,
                depth_level: parent ? parent.depth_level + 1 : 0,
                version: dir.version,
              }
              const localEntity = { ...dir, parent_id: targetDirectoryId, position: patch.position, depth_level: patch.depth_level }
              runOrEnqueueDirectoryUpdate(userId, dir.id, patch, localEntity).then((result) => {
                if ('queued' in result && result.queued) upsertDirectory(localEntity)
                else if ('ok' in result && result.ok) upsertDirectory(result.directory)
                else {
                  const r = result as { ok: false; serverVersion: number; serverDirectory: import('../types').Directory }
                  useConflictStore.getState().openConflict({
                    entityType: 'directory',
                    entityId: dir.id,
                    localVersion: patch.version,
                    serverVersion: r.serverVersion,
                    conflictingFields: findConflictingFields(localEntity, r.serverDirectory),
                    localEntity,
                    serverEntity: r.serverDirectory,
                  })
                }
              })
            }
          })
          setGrabModeActive(false)
          setGrabDropTargetId(null)
          setSelectedItems([])
          setFocusedItemId(columnItems[0]?.id ?? null)
          return
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey) {
          const anchorId = selectionAnchorId ?? focusedItemId
          const anchorIdx = columnItems.findIndex((it) => it.id === anchorId)
          const nextIdx = Math.min(focusIndex + 1, columnItems.length - 1)
          if (nextIdx >= 0) {
            setFocusedItemId(columnItems[nextIdx].id)
            const from = Math.min(anchorIdx >= 0 ? anchorIdx : nextIdx, nextIdx)
            const to = Math.max(anchorIdx >= 0 ? anchorIdx : nextIdx, nextIdx)
            setSelectedItems(columnItems.slice(from, to + 1).map((it) => it.id))
            if (selectionAnchorId == null) setSelectionAnchorId(anchorId ?? columnItems[nextIdx].id)
          }
        } else {
          setSelectionAnchorId(null)
          if (focusIndex < columnItems.length - 1) {
            const next = columnItems[focusIndex + 1]
            setFocusedItemId(next.id)
            setSelectedItems([next.id])
          }
        }
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey) {
          const anchorId = selectionAnchorId ?? focusedItemId
          const anchorIdx = columnItems.findIndex((it) => it.id === anchorId)
          const nextIdx = Math.max(focusIndex - 1, 0)
          if (nextIdx >= 0) {
            setFocusedItemId(columnItems[nextIdx].id)
            const from = Math.min(anchorIdx >= 0 ? anchorIdx : nextIdx, nextIdx)
            const to = Math.max(anchorIdx >= 0 ? anchorIdx : nextIdx, nextIdx)
            setSelectedItems(columnItems.slice(from, to + 1).map((it) => it.id))
            if (selectionAnchorId == null) setSelectionAnchorId(anchorId ?? columnItems[nextIdx].id)
          }
        } else {
          setSelectionAnchorId(null)
          if (focusIndex > 0) {
            const prev = columnItems[focusIndex - 1]
            setFocusedItemId(prev.id)
            setSelectedItems([prev.id])
          }
        }
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectionAnchorId(null)
        if (colIndex > 0) {
          setNavigationPath(navigationPath.slice(0, -1))
          setFocusedColumnIndex(colIndex - 1)
          const prevColItems = items[colIndex - 1] ?? []
          const backId = navigationPath[colIndex - 1] ?? prevColItems[0]?.id ?? null
          setFocusedItemId(backId)
          setSelectedItems(backId ? [backId] : [])
        }
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (focusIndex < 0 || focusIndex >= columnItems.length) return
        const item = columnItems[focusIndex]
        if (item.type === 'directory') {
          setSelectionAnchorId(null)
          setNavigationPath([...navigationPath, item.id])
          setFocusedColumnIndex(colIndex + 1)
          const nextColItems = items[colIndex + 1] ?? []
          const first = nextColItems[0]
          setFocusedItemId(first?.id ?? null)
          setSelectedItems(first ? [first.id] : [])
        }
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        if (focusIndex >= 0 && focusIndex < columnItems.length) {
          const item = columnItems[focusIndex]
          if (item.type === 'task' && userId) {
            const taskStore = useTaskStore.getState()
            const task = taskStore.tasks.find((t) => t.id === item.id)
            if (task) {
              const completing = !task.is_completed
              const now = new Date().toISOString()
              const status: Task['status'] = completing ? 'completed' : 'not_started'
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
                if ('queued' in result && result.queued) upsertTask(localEntity)
                else if ('ok' in result && result.ok) {
                  const updated = result.task
                  upsertTask(updated)
                  if (completing && hasRecurrence(updated)) {
                    const nextDates = getNextOccurrenceDates(updated)
                    if (nextDates) {
                      const allTasks = useTaskStore.getState().tasks
                      const tasksInDir = allTasks.filter(
                        (t) => t.directory_id === updated.directory_id && !t.archived_at
                      )
                      const nextPosition =
                        tasksInDir.length === 0
                          ? 0
                          : Math.max(...tasksInDir.map((t) => t.position)) + 1
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
                  useConflictStore.getState().openConflict({
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
          }
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        const namingNewItemId = useUIStore.getState().namingNewItemId
        if (namingNewItemId) {
          setNamingNewItemId(null)
        }
        setFocusedItemId(null)
        setSelectedItems([])
        setSelectionAnchorId(null)
        return
      }

      const creationContextActive = columnItems.length === 0
      if (creationContextActive && !mod && (e.key === 't' || e.key === 'd')) {
        e.preventDefault()
        if (!userId) return
        const currentDirectoryId = colIndex === 0 ? null : navigationPath[colIndex - 1] ?? null
        const directories = useDirectoryStore.getState().directories
        const parentDir = currentDirectoryId
          ? directories.find((d) => d.id === currentDirectoryId)
          : null
        const depthLevel = parentDir ? parentDir.depth_level + 1 : 0
        if (e.key === 't') {
          if (currentDirectoryId === null) {
            useFeedbackStore.getState().addToast('error', 'Tasks must live inside a directory. Please create the directory or move inside a directory to create a task')
            return
          }
          const tasks = useTaskStore.getState().tasks
          const tasksInDir = tasks.filter((t) => t.directory_id === currentDirectoryId)
          const nextPosition =
            tasksInDir.length === 0 ? 0 : Math.max(...tasksInDir.map((t) => t.position)) + 1
          const task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
            title: '',
            directory_id: currentDirectoryId,
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
            position: nextPosition,
            recurrence_frequency: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            checklist_items: [],
            estimated_duration_minutes: null,
            actual_duration_minutes: null,
            url: null,
            version: 1,
          }
          insertTask(userId, task).then((t) => {
            upsertTask(t)
            recordAction(userId, 'task_create', { task: t })
            setFocusedItemId(t.id)
            setFocusedColumnIndex(colIndex)
            setNamingNewItemId(t.id)
          })
        } else {
          const dirsInParent = directories.filter((d) => d.parent_id === currentDirectoryId)
          const nextPosition =
            dirsInParent.length === 0 ? 0 : Math.max(...dirsInParent.map((d) => d.position)) + 1
          insertDirectory(userId, {
            name: '',
            parent_id: currentDirectoryId,
            position: nextPosition,
            depth_level: depthLevel,
            version: 1,
          }).then((d) => {
            upsertDirectory(d)
            recordAction(userId, 'directory_create', { directory: d })
            setFocusedItemId(d.id)
            setFocusedColumnIndex(colIndex)
            setNamingNewItemId(d.id)
          })
        }
        return
      }

      if (mod && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        if (copyRecursive()) {
          setSelectionAnchorId(null)
        }
        return
      }
      if (mod && e.key === 'c') {
        e.preventDefault()
        if (copySelection()) {
          setSelectionAnchorId(null)
        }
        return
      }
      if (mod && e.key === 'x') {
        e.preventDefault()
        if (cutSelection()) {
          setSelectionAnchorId(null)
        }
        return
      }
      if (mod && e.key === 'v') {
        e.preventDefault()
        if (!userId) return
        const targetDirectoryId = colIndex === 0 ? null : navigationPath[colIndex - 1] ?? null
        paste(userId, targetDirectoryId).then(({ newTaskIds, newDirectoryIds }) => {
          const newIds = [...newDirectoryIds, ...newTaskIds]
          if (newIds.length > 0) {
            setFocusedItemId(newIds[0])
            setSelectedItems(newIds)
          }
        })
        return
      }

      if ((mod && e.key === 'Delete') || (mod && e.key === 'Backspace')) {
        e.preventDefault()
        const selected = useAppStore.getState().selectedItems
        const focused = useAppStore.getState().focusedItemId
        const ids = selected.length > 0 ? selected : (focused ? [focused] : [])
        if (ids.length > 0) setPendingDeleteIds(ids)
        return
      }

      if (mod && e.key === 'a') {
        e.preventDefault()
        setSelectedItems(columnItems.map((it) => it.id))
        setSelectionAnchorId(null)
        return
      }

      if (mod && e.key === 'ArrowUp') {
        e.preventDefault()
        const first = columnItems[0]
        if (first) {
          setFocusedItemId(first.id)
          setSelectedItems([first.id])
          setSelectionAnchorId(null)
        }
        return
      }

      if (mod && e.key === 'ArrowDown') {
        e.preventDefault()
        const last = columnItems[columnItems.length - 1]
        if (last) {
          setFocusedItemId(last.id)
          setSelectedItems([last.id])
          setSelectionAnchorId(null)
        }
        return
      }

      if (mod && e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft -= 300
        }
        return
      }

      if (mod && e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault()
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft += 300
        }
        return
      }

      if (e.key === 'Home') {
        e.preventDefault()
        setFocusedColumnIndex(0)
        setNavigationPath([])
        const rootItems = items[0] ?? []
        const first = rootItems[0]
        setFocusedItemId(first?.id ?? null)
        setSelectedItems(first ? [first.id] : [])
        setSelectionAnchorId(null)
        if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0
        return
      }

      if (e.key === 'End') {
        e.preventDefault()
        const lastCol = columnCount - 1
        setFocusedColumnIndex(lastCol)
        setNavigationPath(navigationPath)
        const lastColItems = items[lastCol] ?? []
        const first = lastColItems[0]
        setFocusedItemId(first?.id ?? null)
        setSelectedItems(first ? [first.id] : [])
        setSelectionAnchorId(null)
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    scrollContainerRef,
    columnCount,
    navigationPath,
    focusedItemId,
    focusedColumnIndex,
    selectionAnchorId,
    setNavigationPath,
    setFocusedItemId,
    setFocusedColumnIndex,
    setSelectedItems,
    setSelectionAnchorId,
    setNamingNewItemId,
    setPendingDeleteIds,
    grabModeActive,
    setGrabModeActive,
    setGrabDropTargetId,
    userId,
    upsertTask,
    upsertDirectory,
  ])
}
