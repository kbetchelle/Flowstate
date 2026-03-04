import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { useAppStore } from './stores/appStore'
import { useAuthStore } from './stores/authStore'
import { useUIStore } from './stores/uiStore'
import { useTaskStore } from './stores/taskStore'
import { TopBar } from './components/TopBar'
import { MainArea } from './components/MainArea'
import { CommandPalette } from './components/CommandPalette'
import { FullEditPanel } from './components/FullEditPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ConflictDialog } from './components/ConflictDialog'
import { OnboardingFlow } from './components/OnboardingFlow'
import { FeedbackToast } from './components/FeedbackToast'
import { SearchOverlay } from './components/SearchOverlay'
import { ShortcutSheet } from './components/ShortcutSheet'
import { HelpSheet } from './components/HelpSheet'
import { DependencyGraphView } from './components/DependencyGraphView'
import { subscribeTasks, subscribeDirectories } from './lib/realtime'
import { fetchDirectories } from './api/directories'
import { fetchTasks, autoArchiveCompletedOlderThan5Days } from './api/tasks'
import { fetchUserSettings } from './api/userSettings'
import { fetchLinksForUser } from './api/links'
import { useLinkStore } from './stores/linkStore'
import { useDirectoryStore } from './stores/directoryStore'
import { useNetworkStore } from './stores/networkStore'
import { useThemeStore } from './stores/themeStore'
import { useSettingsStore } from './stores/settingsStore'
import { undo, redo } from './lib/undo'
import { processOfflineQueue } from './lib/offlineQueue'
import { keyEventToCombo, getActionIdForCombo } from './constants/shortcuts'
import './index.css'

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setMessage(error.message)
    else setMessage('Check your email for the confirmation link.')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setMessage(error.message)
  }

  return (
    <div style={{ padding: 24, maxWidth: 360, margin: '40px auto' }}>
      <h1 style={{ marginTop: 0 }}>Flowstate</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Sign in or create an account.</p>
      <form onSubmit={handleSignIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 16, padding: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
            Sign in
          </button>
          <button type="button" onClick={handleSignUp} disabled={loading} style={{ padding: '8px 16px' }}>
            Sign up
          </button>
        </div>
      </form>
      {message && <p style={{ marginTop: 16, color: '#666' }}>{message}</p>}
    </div>
  )
}

function AppShell() {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const searchOverlayOpen = useAppStore((s) => s.searchOverlayOpen)
  const setSearchOverlayOpen = useAppStore((s) => s.setSearchOverlayOpen)
  const shortcutSheetOpen = useAppStore((s) => s.shortcutSheetOpen)
  const setShortcutSheetOpen = useAppStore((s) => s.setShortcutSheetOpen)
  const helpSheetOpen = useAppStore((s) => s.helpSheetOpen)
  const setHelpSheetOpen = useAppStore((s) => s.setHelpSheetOpen)
  const dependencyGraphOpen = useAppStore((s) => s.dependencyGraphOpen)
  const setDependencyGraphOpen = useAppStore((s) => s.setDependencyGraphOpen)
  const setShowCompleted = useAppStore((s) => s.setShowCompleted)
  const setColorMode = useAppStore((s) => s.setColorMode)
  const userId = useAuthStore((s) => s.user?.id)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const mode = useThemeStore((s) => s.mode)
  const accent = useThemeStore((s) => s.accent)
  const setMode = useThemeStore((s) => s.setMode)
  const setAccent = useThemeStore((s) => s.setAccent)

  useEffect(() => {
    try {
      const storedMode = localStorage.getItem('flowstate_theme_mode')
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setMode(storedMode)
      }
      const storedAccent = localStorage.getItem('flowstate_theme_accent')
      setAccent(storedAccent || null)
    } catch (_) {}
  }, [setMode, setAccent])

  useEffect(() => {
    try {
      localStorage.setItem('flowstate_theme_mode', mode)
    } catch (_) {}
    const applyResolved = () => {
      const resolved =
        mode === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : mode
      document.documentElement.setAttribute('data-theme', resolved)
    }
    applyResolved()
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyResolved()
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [mode])

  useEffect(() => {
    try {
      if (accent) localStorage.setItem('flowstate_theme_accent', accent)
      else localStorage.removeItem('flowstate_theme_accent')
    } catch (_) {}
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent)
    } else {
      document.documentElement.style.removeProperty('--accent')
    }
  }, [accent])

  useEffect(() => {
    if (currentView !== 'main_db' || !userId) return
    const tasks = useTaskStore.getState().tasks
    autoArchiveCompletedOlderThan5Days(userId, tasks).then((archived) => {
      archived.forEach((t) => upsertTask(t))
    })
  }, [currentView, userId, upsertTask])

  useEffect(() => {
    const grabPendingRef = { current: false }
    let grabTimeout: ReturnType<typeof setTimeout> | null = null
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const inEditor =
        (document.activeElement as HTMLElement)?.closest?.('input, textarea, [data-full-edit-panel]')

      if (!inEditor && e.ctrlKey && e.key === ' ') {
        e.preventDefault()
        grabPendingRef.current = true
        if (grabTimeout) clearTimeout(grabTimeout)
        grabTimeout = setTimeout(() => {
          grabPendingRef.current = false
          grabTimeout = null
        }, 1000)
        return
      }
      if (grabPendingRef.current && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        grabPendingRef.current = false
        if (grabTimeout) {
          clearTimeout(grabTimeout)
          grabTimeout = null
        }
        useUIStore.getState().setGrabModeActive(true)
        useUIStore.getState().setGrabDropTargetId(useAppStore.getState().focusedItemId)
        return
      }
      if (grabPendingRef.current) {
        grabPendingRef.current = false
        if (grabTimeout) {
          clearTimeout(grabTimeout)
          grabTimeout = null
        }
      }

      const combo = keyEventToCombo(e)
      const customShortcuts = useSettingsStore.getState().settings?.custom_shortcuts ?? {}
      const remappedActionId = getActionIdForCombo(combo, customShortcuts)
      if (remappedActionId && !inEditor) {
        const actions: Record<string, () => void> = {
          'view.main': () => setCurrentView('main_db'),
          'view.upcoming': () => setCurrentView('upcoming'),
          'view.archive': () => setCurrentView('archive'),
          'command.palette': () => setCommandPaletteOpen(true),
          'search.open': () => setSearchOverlayOpen(true),
          'view.shortcutSheet': () => setShortcutSheetOpen(true),
          'settings.open': () => setCurrentView('settings'),
          'view.completedToggle': () => setShowCompleted(!useAppStore.getState().showCompleted),
          'action.undo': () => { const uid = useAuthStore.getState().user?.id; if (uid) void undo(uid) },
          'action.redo': () => { const uid = useAuthStore.getState().user?.id; if (uid) void redo(uid) },
          'edit.full': () => {
            const focusedItemId = useAppStore.getState().focusedItemId
            const tasks = useTaskStore.getState().tasks
            if (focusedItemId && tasks.some((t) => t.id === focusedItemId)) {
              useUIStore.getState().setEditPanelTaskId(focusedItemId)
            }
          },
          'task.delete': () => {
            const ids = useAppStore.getState().selectedItems
            if (ids.length > 0) useUIStore.getState().setPendingDeleteIds(ids)
          },
          'clipboard.copy': () => { /* contextual: handled in column */ },
          'clipboard.cut': () => { /* contextual */ },
          'clipboard.paste': () => { /* contextual */ },
          'clipboard.copyRecursive': () => { /* contextual */ },
          'select.all': () => { /* contextual */ },
          'color.none': () => setColorMode('none'),
          'color.category': () => setColorMode('category'),
          'color.priority': () => setColorMode('priority'),
        }
        const run = actions[remappedActionId]
        if (run) {
          e.preventDefault()
          run()
          return
        }
      }

      if (e.key === 'k' && mod) {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      if (e.key === '\\') {
        const inListOrEditor = (document.activeElement as HTMLElement)?.closest?.(
          '[data-command-palette-context]'
        )
        if (inListOrEditor) {
          e.preventDefault()
          setCommandPaletteOpen(true)
        }
        return
      }
      if (!inEditor && mod && e.shiftKey && e.key === 's') {
        e.preventDefault()
        setSearchOverlayOpen(true)
        return
      }
      if (!inEditor && mod && e.key === '/') {
        e.preventDefault()
        setShortcutSheetOpen(true)
        return
      }

      if (!mod) return
      if (e.key === '1' && !e.shiftKey) {
        e.preventDefault()
        setCurrentView('main_db')
        return
      }
      if (e.key === 'l' && e.shiftKey) {
        e.preventDefault()
        setCurrentView('upcoming')
        return
      }
      if (e.key === 'a' && e.shiftKey) {
        e.preventDefault()
        setCurrentView('archive')
        return
      }
      if (e.key === ',') {
        e.preventDefault()
        setCurrentView('settings')
        return
      }
      if (mod && e.shiftKey && e.key === 'e') {
        if (inEditor) return
        const focusedItemId = useAppStore.getState().focusedItemId
        const tasks = useTaskStore.getState().tasks
        const isTask = focusedItemId && tasks.some((t) => t.id === focusedItemId)
        if (isTask) {
          e.preventDefault()
          useUIStore.getState().setEditPanelTaskId(focusedItemId)
        }
        return
      }
      if (!inEditor && mod && e.altKey) {
        if (e.key === 'n') {
          e.preventDefault()
          setColorMode('none')
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          setColorMode('category')
          return
        }
        if (e.key === 'p') {
          e.preventDefault()
          setColorMode('priority')
          return
        }
      }
      if (!inEditor && mod && e.shiftKey && e.key === 'h') {
        e.preventDefault()
        setShowCompleted(!useAppStore.getState().showCompleted)
        return
      }
      if (!inEditor && mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const userId = useAuthStore.getState().user?.id
        if (userId) void undo(userId)
        return
      }
      if (!inEditor && mod && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        const userId = useAuthStore.getState().user?.id
        if (userId) void redo(userId)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentView, setCommandPaletteOpen, setSearchOverlayOpen, setShortcutSheetOpen, setShowCompleted, setColorMode])

  const goToSettings = () => setCurrentView('settings')
  const closePalette = () => setCommandPaletteOpen(false)
  const openSearch = () => setSearchOverlayOpen(true)
  const closeSearch = () => setSearchOverlayOpen(false)
  const openHelp = () => setHelpSheetOpen(true)
  const closeHelp = () => setHelpSheetOpen(false)
  const closeShortcutSheet = () => setShortcutSheetOpen(false)
  const closeDependencyGraph = () => setDependencyGraphOpen(false)

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const listener = () => setIsMobile(mq.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  const isOnline = useNetworkStore((s) => s.isOnline)
  const BOTTOM_NAV_HEIGHT = 56
  const FAB_SIZE = 56

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        onSettingsClick={goToSettings}
        onSearchClick={openSearch}
        onHelpClick={openHelp}
      />
      {!isOnline && (
        <div
          role="status"
          style={{
            padding: '8px 16px',
            backgroundColor: '#fff3e0',
            color: '#e65100',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          You're offline. Changes will sync when you're back online.
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isMobile ? BOTTOM_NAV_HEIGHT : 0,
        }}
      >
        <MainArea currentView={currentView} />
      </div>
      {isMobile && (
        <>
          <button
            type="button"
            aria-label="New task or directory"
            onClick={() => setCommandPaletteOpen(true)}
            style={{
              position: 'fixed',
              bottom: BOTTOM_NAV_HEIGHT + 16,
              right: 16,
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'var(--accent, #1976d2)',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 100,
            }}
          >
            +
          </button>
          <nav
            role="navigation"
            aria-label="Main and Search"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: BOTTOM_NAV_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: 'var(--bg, #fafafa)',
              zIndex: 99,
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentView('main_db')}
              style={{
                flex: 1,
                padding: 12,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: currentView === 'main_db' ? 600 : 400,
              }}
            >
              Main
            </button>
            <button
              type="button"
              onClick={openSearch}
              style={{
                flex: 1,
                padding: 12,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </nav>
        </>
      )}
      {commandPaletteOpen && (
        <CommandPalette onClose={closePalette} />
      )}
      {searchOverlayOpen && (
        <SearchOverlay onClose={closeSearch} />
      )}
      {shortcutSheetOpen && (
        <ShortcutSheet onClose={closeShortcutSheet} />
      )}
      {helpSheetOpen && (
        <HelpSheet onClose={closeHelp} />
      )}
      {dependencyGraphOpen && (
        <DependencyGraphView onClose={closeDependencyGraph} />
      )}
      <FullEditPanel />
      <ConfirmDialog />
      <ConflictDialog />
      <OnboardingFlow />
      <FeedbackToast />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const setAuthSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const next = urlParams.get('next') ?? '/'

    const init = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', next)
      }
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)
      setAuthSession(s)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthSession(s)
    })

    return () => subscription.unsubscribe()
  }, [setAuthSession])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  return <AppShellWithRealtime userId={session.user.id} />
}

function AppShellWithRealtime({ userId }: { userId: string }) {
  const setDirectories = useDirectoryStore((s) => s.setDirectories)
  const setTasks = useTaskStore((s) => s.setTasks)
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const isOnline = useNetworkStore((s) => s.isOnline)
  const wasOfflineRef = useRef(false)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const setMode = useThemeStore((s) => s.setMode)
  const setAccent = useThemeStore((s) => s.setAccent)
  const setLinks = useLinkStore((s) => s.setLinks)

  useEffect(() => {
    if (!isOnline) wasOfflineRef.current = true
    else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      void processOfflineQueue(userId)
    }
  }, [isOnline, userId])

  useEffect(() => {
    const unsubTasks = subscribeTasks(userId)
    const unsubDirs = subscribeDirectories(userId)
    return () => {
      void Promise.all([unsubTasks(), unsubDirs()]).catch(() => {})
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [dirs, tasks, settings, links] = await Promise.all([
          fetchDirectories(userId),
          fetchTasks(userId),
          fetchUserSettings(userId),
          fetchLinksForUser(userId),
        ])
        if (!cancelled) {
          setDirectories(dirs)
          setTasks(tasks)
          setLinks(links)
          if (settings) {
            setSettings(settings)
            setMode(settings.theme)
            setAccent(settings.accent)
          }
          const archived = await autoArchiveCompletedOlderThan5Days(userId, tasks)
          if (!cancelled) archived.forEach((t) => upsertTask(t))
        }
      } catch (_) {
        if (!cancelled) {
          setDirectories([])
          setTasks([])
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, setDirectories, setTasks, setLinks, setSettings, setMode, setAccent, upsertTask])

  return <AppShell />
}
