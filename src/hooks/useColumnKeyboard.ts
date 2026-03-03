/**
 * Keyboard navigation for column view: arrows, selection, scroll, Home/End.
 * Spec §5 contextual nav.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { updateTask } from '../api/tasks'
import type { ColumnItem } from '../components/ColumnList'

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

  const isInputFocused = useRef(false)

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
              updateTask(userId, task.id, {
                ...task,
                is_completed: !task.is_completed,
                version: task.version,
              }).then(upsertTask)
            }
          }
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setFocusedItemId(null)
        setSelectedItems([])
        setSelectionAnchorId(null)
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
    userId,
    upsertTask,
  ])
}
