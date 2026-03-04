/**
 * Single command palette: Cmd+K or \. Creation and view switching (spec §2, §5).
 * No "Go to directory" / "Go to parent". No CreationModal.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useViewStore } from '../stores/viewStore'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useDirectoryStore } from '../stores/directoryStore'
import { useUIStore } from '../stores/uiStore'
import { insertTask } from '../api/tasks'
import { insertDirectory } from '../api/directories'
import { recordAction } from '../lib/undo'
import type { Task } from '../types'

export interface CommandItem {
  id: string
  label: string
  shortcut?: string
  run: () => void
}

function getModLabel(): string {
  return typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')
    ? 'Cmd'
    : 'Ctrl'
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const navigationPath = useAppStore((s) => s.navigationPath)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const setFocusedItemId = useAppStore((s) => s.setFocusedItemId)
  const setFocusedColumnIndex = useAppStore((s) => s.setFocusedColumnIndex)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)

  const setViewType = useViewStore((s) => s.setViewType)

  const user = useAuthStore((s) => s.user)
  const userId = user?.id

  const upsertTask = useTaskStore((s) => s.upsertTask)
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory)
  const directories = useDirectoryStore((s) => s.directories)

  const setNamingNewItemId = useUIStore((s) => s.setNamingNewItemId)

  const currentDirectoryId = navigationPath[navigationPath.length - 1] ?? null
  const parentDirectory = currentDirectoryId
    ? directories.find((d) => d.id === currentDirectoryId)
    : null
  const depthLevel = parentDirectory ? parentDirectory.depth_level + 1 : 0

  const commands = useMemo<CommandItem[]>(() => {
    const mod = getModLabel()
    const items: CommandItem[] = [
      {
        id: 'new-task',
        label: 'New task',
        run: () => {
          if (!userId) return
          const dirId = currentDirectoryId
          const task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
            title: '',
            directory_id: dirId,
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
            position: 0,
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
            setFocusedColumnIndex(navigationPath.length)
            setNamingNewItemId(t.id)
            setCommandPaletteOpen(false)
            onClose()
          })
        },
      },
      {
        id: 'new-directory',
        label: 'New directory',
        run: () => {
          if (!userId) return
          insertDirectory(userId, {
            name: '',
            parent_id: currentDirectoryId,
            position: 0,
            depth_level: depthLevel,
            version: 1,
          }).then((d) => {
            upsertDirectory(d)
            recordAction(userId, 'directory_create', { directory: d })
            setFocusedItemId(d.id)
            setFocusedColumnIndex(navigationPath.length)
            setNamingNewItemId(d.id)
            setCommandPaletteOpen(false)
            onClose()
          })
        },
      },
      {
        id: 'view-list',
        label: 'Switch to List view',
        run: () => {
          setViewType(currentDirectoryId, 'list')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'view-calendar',
        label: 'Switch to Calendar view',
        run: () => {
          setViewType(currentDirectoryId, 'calendar')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'view-kanban',
        label: 'Switch to Kanban view',
        run: () => {
          setViewType(currentDirectoryId, 'kanban')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'view-main',
        label: 'Main view',
        shortcut: `${mod}+1`,
        run: () => {
          setCurrentView('main_db')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'view-upcoming',
        label: 'Upcoming view',
        shortcut: `${mod}+Shift+L`,
        run: () => {
          setCurrentView('upcoming')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'view-archive',
        label: 'Archive view',
        shortcut: `${mod}+Shift+A`,
        run: () => {
          setCurrentView('archive')
          setCommandPaletteOpen(false)
          onClose()
        },
      },
      {
        id: 'dependency-graph',
        label: 'Open Dependency Graph',
        run: () => {
          useAppStore.getState().setDependencyGraphOpen(true)
          setCommandPaletteOpen(false)
          onClose()
        },
      },
    ]
    return items
  }, [
    userId,
    currentDirectoryId,
    depthLevel,
    navigationPath.length,
    setViewType,
    setCurrentView,
    setFocusedItemId,
    setFocusedColumnIndex,
    setNamingNewItemId,
    setCommandPaletteOpen,
    upsertTask,
    upsertDirectory,
    onClose,
  ])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const len = filtered.length
    if (len === 0) return
    setSelectedIndex((i) => (i < 0 ? 0 : i >= len ? len - 1 : i))
  }, [filtered.length])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const selected = el.querySelector('[data-selected="true"]') as HTMLElement | null
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, filtered])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd) cmd.run()
      return
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #fff)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: 420,
          maxHeight: 360,
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
          placeholder="Type a command..."
          aria-label="Filter commands"
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderBottom: '1px solid #e0e0e0',
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
            maxHeight: 280,
            padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 12, color: '#666' }}>No matching commands</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                role="option"
                aria-selected={i === selectedIndex}
                data-selected={i === selectedIndex ? 'true' : undefined}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: i === selectedIndex ? 'rgba(0,0,0,0.06)' : undefined,
                }}
                onClick={() => cmd.run()}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span>{cmd.label}</span>
                {cmd.shortcut && (
                  <span style={{ marginLeft: 8, color: '#888', fontSize: 13 }}>
                    {cmd.shortcut}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
