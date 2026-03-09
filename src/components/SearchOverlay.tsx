/**
 * Search overlay: Cmd+Shift+S. Search tasks; keyboard nav; Escape to close.
 * Spec §5 search.open, Phase 12.
 */

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { searchTasks } from '../api/search'
import type { Task } from '../types'

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [results, setResults] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const setSearchOverlayOpen = useAppStore((s) => s.setSearchOverlayOpen)
  const setFocusedItemId = useAppStore((s) => s.setFocusedItemId)
  const setEditPanelTaskId = useUIStore((s) => s.setEditPanelTaskId)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const t = setTimeout(() => {
      searchTasks(userId, { query: query.trim() || undefined, limit: 50 })
        .then(setResults)
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [userId, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const len = results.length
    if (len === 0) return
    setSelectedIndex((i) => (i < 0 ? 0 : i >= len ? len - 1 : i))
  }, [results.length])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const selected = el.querySelector('[data-selected="true"]') as HTMLElement | null
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, results])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSearchOverlayOpen(false)
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % Math.max(1, results.length))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + results.length) % Math.max(1, results.length))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const task = results[selectedIndex]
      if (task) {
        setFocusedItemId(task.id)
        setEditPanelTaskId(task.id)
        setSearchOverlayOpen(false)
        onClose()
      }
      return
    }
  }

  const openTask = (task: Task) => {
    setFocusedItemId(task.id)
    setEditPanelTaskId(task.id)
    setSearchOverlayOpen(false)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-label="Search tasks"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSearchOverlayOpen(false)
          onClose()
        }
      }}
    >
      <div
        className="glass-surface"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks..."
          aria-label="Search"
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderBottom: '1px solid var(--divider)',
            fontSize: 16,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div
          ref={listRef}
          role="listbox"
          style={{
            overflowY: 'auto',
            maxHeight: 320,
            padding: 4,
          }}
        >
          {loading ? (
            <div style={{ padding: 12, color: 'var(--text-secondary)' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-secondary)' }}>
              {query.trim() ? 'No matching tasks' : 'Type to search tasks'}
            </div>
          ) : (
            results.map((task, i) => (
              <div
                key={task.id}
                role="option"
                aria-selected={i === selectedIndex}
                data-selected={i === selectedIndex ? 'true' : undefined}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: i === selectedIndex ? 'var(--highlight-bg)' : undefined,
                }}
                onClick={() => openTask(task)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ fontWeight: 500 }}>{task.title || '(No title)'}</span>
                {task.due_date && (
                  <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>{task.due_date}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
