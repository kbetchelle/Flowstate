import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import {
  isBiometricSupported,
  getBiometricData,
  setupBiometric,
  authenticateWithBiometric,
  clearBiometric,
  usernameToEmail,
} from './lib/biometric'
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
import { fetchDirectories, seedFirstProject } from './api/directories'
import { fetchTasks, autoArchiveCompletedOlderThan5Days } from './api/tasks'
import { fetchUserSettings } from './api/userSettings'
import { fetchLinksForUser } from './api/links'
import { useLinkStore } from './stores/linkStore'
import { fetchProfile } from './api/profiles'
import { useProfileStore } from './stores/profileStore'
import { useDirectoryStore } from './stores/directoryStore'
import { useNetworkStore } from './stores/networkStore'
import { useThemeStore } from './stores/themeStore'
import { useSettingsStore } from './stores/settingsStore'
import { undo, redo } from './lib/undo'
import { processOfflineQueue } from './lib/offlineQueue'
import { keyEventToCombo, getActionIdForCombo } from './constants/shortcuts'
import './index.css'

function validateUsername(username: string): string | null {
  if (!username) return 'Username is required.'
  if (!/^[a-zA-Z0-9._-]+$/.test(username))
    return 'Username can only contain letters, numbers, dots, hyphens, and underscores.'
  return null
}

function LoginScreen({ successMessage, onCreateAccount }: { successMessage?: string | null; onCreateAccount: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [biometricUsername, setBiometricUsername] = useState('')

  useEffect(() => {
    if (!isBiometricSupported()) return
    const data = getBiometricData()
    if (data) {
      setBiometricReady(true)
      setBiometricUsername(data.username)
      setUsername(data.username)
    }
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const signInEmail = username.includes('@') ? username.trim().toLowerCase() : usernameToEmail(username)
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password,
    })
    setLoading(false)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('email not confirmed'))
        setMessage('Please confirm your email address before signing in. Check your inbox.')
      else if (msg.includes('rate') || msg.includes('limit'))
        setMessage('Too many sign-in attempts. Please wait a moment and try again.')
      else
        setMessage('Incorrect username/email or password. Please try again.')
    } else if (isBiometricSupported() && !getBiometricData()) {
      sessionStorage.setItem('flowstate_offer_biometric', username)
    }
  }

  const handleBiometric = async () => {
    setLoading(true)
    setMessage(null)
    const data = await authenticateWithBiometric()
    if (!data) {
      setLoading(false)
      setMessage('Biometric authentication failed. Please sign in with your password.')
      return
    }
    const { error } = await supabase.auth.refreshSession({ refresh_token: data.refreshToken })
    setLoading(false)
    if (error) {
      setMessage('Session expired. Please sign in with your password.')
      clearBiometric()
      setBiometricReady(false)
    }
    // On success, onAuthStateChange in App handles the rest
  }

  return (
    <div style={glassCardStyle}>
      <h1 style={{ marginTop: 0 }}>Flowstate</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>Sign in to your account.</p>

      {successMessage && (
        <p style={{ color: 'var(--color-success)', fontSize: 14, marginBottom: 16 }}>{successMessage}</p>
      )}

      {biometricReady && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={handleBiometric}
            disabled={loading}
            style={{ display: 'block', width: '100%', padding: '12px 16px', marginBottom: 8, fontSize: 15, cursor: 'pointer' }}
          >
            Sign in as {biometricUsername} with biometric
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 16px' }}>
            or enter your password below
          </p>
        </div>
      )}

      <form onSubmit={handleSignIn}>
        <input
          type="text"
          placeholder="Username or email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <span
            role="button"
            tabIndex={0}
            onClick={() => setShowPassword(!showPassword)}
            onKeyDown={(e) => e.key === 'Enter' && setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              userSelect: 'none',
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </span>
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            borderRadius: 'var(--radius-control)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {message && <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>{message}</p>}

      <p style={{ marginTop: 20, textAlign: 'center', marginBottom: 0 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onCreateAccount}
          onKeyDown={(e) => e.key === 'Enter' && onCreateAccount()}
          style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}
        >
          Create Account
        </span>
      </p>
    </div>
  )
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one capital letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}

const glassCardStyle: React.CSSProperties = {
  maxWidth: 400,
  margin: '40px auto',
  padding: 32,
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-panel)',
  backdropFilter: 'blur(12px) saturate(180%)',
  WebkitBackdropFilter: 'blur(12px) saturate(180%)',
  boxShadow: 'var(--glass-shadow), var(--glass-shadow-inset)',
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--input-border)',
  borderRadius: 'var(--radius-control)',
  boxSizing: 'border-box',
  background: 'transparent',
  color: 'var(--text)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-secondary)',
  marginBottom: 4,
}

const fieldErrorStyle: React.CSSProperties = {
  color: 'var(--color-error)',
  fontSize: 12,
  marginTop: 4,
}

function CreateAccountScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = 'A valid email address is required.'
    if (!firstName.trim()) newErrors.firstName = 'First name is required.'
    if (!lastName.trim()) newErrors.lastName = 'Last name is required.'
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required.'
    } else if (new Date(dateOfBirth) > new Date()) {
      newErrors.dateOfBirth = 'Date of birth cannot be in the future.'
    }

    const usernameErr = validateUsername(username)
    if (usernameErr) newErrors.username = usernameErr

    const passwordErr = validatePassword(password)
    if (passwordErr) newErrors.password = passwordErr

    if (password !== confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setGeneralError(null)
    setLoading(true)

    const { data: taken } = await supabase.rpc('is_username_taken', { check_username: username })
    if (taken) {
      setErrors({ username: 'This username is already taken.' })
      setLoading(false)
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          contact_email: normalizedEmail,
          date_of_birth: dateOfBirth,
        },
      },
    })

    setLoading(false)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered'))
        setGeneralError('An account with this email already exists. Try signing in instead.')
      else if (msg.includes('valid email') || msg.includes('invalid'))
        setGeneralError('Please check your email address and try again.')
      else if (msg.includes('password'))
        setGeneralError('Password does not meet requirements. Use at least 8 characters with a capital letter and a number.')
      else if (msg.includes('rate') || msg.includes('limit'))
        setGeneralError('Too many attempts. Please wait a moment and try again.')
      else
        setGeneralError('Something went wrong creating your account. Please try again.')
    } else {
      onSuccess()
    }
  }

  return (
    <div style={glassCardStyle}>
      <h1 style={{ marginTop: 0, marginBottom: 4 }}>Create Account</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
        Fill in your details to get started.
      </p>

      {generalError && (
        <p style={{ color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{generalError}</p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError('email') }}
            style={inputStyle}
            autoComplete="email"
          />
          {errors.email && <p style={fieldErrorStyle}>{errors.email}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); clearError('firstName') }}
              style={inputStyle}
              autoComplete="given-name"
            />
            {errors.firstName && <p style={fieldErrorStyle}>{errors.firstName}</p>}
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); clearError('lastName') }}
              style={inputStyle}
              autoComplete="family-name"
            />
            {errors.lastName && <p style={fieldErrorStyle}>{errors.lastName}</p>}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Date of Birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => { setDateOfBirth(e.target.value); clearError('dateOfBirth') }}
            style={inputStyle}
            autoComplete="bday"
          />
          {errors.dateOfBirth && <p style={fieldErrorStyle}>{errors.dateOfBirth}</p>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); clearError('username') }}
            style={inputStyle}
            autoComplete="username"
          />
          {errors.username && <p style={fieldErrorStyle}>{errors.username}</p>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password') }}
              style={{ ...inputStyle, paddingRight: 40 }}
              autoComplete="new-password"
            />
            <span
              role="button"
              tabIndex={0}
              onClick={() => setShowPassword(!showPassword)}
              onKeyDown={(e) => e.key === 'Enter' && setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-tertiary)',
                userSelect: 'none',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </span>
          </div>
          {errors.password && <p style={fieldErrorStyle}>{errors.password}</p>}
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>
            At least 8 characters, one capital letter, and one number.
          </p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
              style={{ ...inputStyle, paddingRight: 40 }}
              autoComplete="new-password"
            />
            <span
              role="button"
              tabIndex={0}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              onKeyDown={(e) => e.key === 'Enter' && setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-tertiary)',
                userSelect: 'none',
              }}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </span>
          </div>
          {errors.confirmPassword && <p style={fieldErrorStyle}>{errors.confirmPassword}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            borderRadius: 'var(--radius-control)',
          }}
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: 20, textAlign: 'center', marginBottom: 0 }}>
        <span
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => e.key === 'Enter' && onBack()}
          style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}
        >
          Back to sign in
        </span>
      </p>
    </div>
  )
}

function BiometricSetupModal({
  username,
  refreshToken,
  onDone,
}: {
  username: string
  refreshToken: string
  onDone: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleEnable = async () => {
    setStatus('loading')
    const ok = await setupBiometric(username, refreshToken)
    if (ok) {
      setStatus('success')
      setTimeout(onDone, 1200)
    } else {
      setStatus('error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 12,
          padding: 32,
          maxWidth: 360,
          width: '100%',
          margin: 16,
          backdropFilter: 'var(--glass-blur)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Enable biometric login?</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Sign in faster next time using Face ID, Touch ID, or your device's fingerprint sensor.
        </p>
        {status === 'idle' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button type="button" onClick={handleEnable} style={{ flex: 1, padding: '10px 16px' }}>
              Enable
            </button>
            <button type="button" onClick={onDone} style={{ flex: 1, padding: '10px 16px' }}>
              Skip
            </button>
          </div>
        )}
        {status === 'loading' && <p>Setting up…</p>}
        {status === 'success' && (
          <p style={{ color: 'var(--color-success, green)' }}>Biometric login enabled!</p>
        )}
        {status === 'error' && (
          <>
            <p style={{ color: 'var(--color-error, red)' }}>
              Biometric setup failed. This feature may not be supported on your device or browser.
            </p>
            <button type="button" onClick={onDone} style={{ marginTop: 8, padding: '8px 16px' }}>
              Close
            </button>
          </>
        )}
      </div>
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
            backgroundColor: 'var(--toast-info-bg)',
            color: 'var(--color-info)',
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
        <MainArea currentView={currentView} onCloseSettings={() => setCurrentView('main_db')} />
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
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              boxShadow: 'var(--glass-shadow)',
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
              borderTop: '1px solid var(--glass-border)',
              backgroundColor: 'var(--bg)',
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
  const [offerBiometric, setOfferBiometric] = useState<{ username: string; refreshToken: string } | null>(null)
  const [authView, setAuthView] = useState<'login' | 'create-account'>('login')
  const [signupSuccessMessage, setSignupSuccessMessage] = useState<string | null>(null)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setAuthSession(s)

      if (event === 'SIGNED_IN' && s) {
        const pendingUsername = sessionStorage.getItem('flowstate_offer_biometric')
        if (pendingUsername) {
          sessionStorage.removeItem('flowstate_offer_biometric')
          setOfferBiometric({ username: pendingUsername, refreshToken: s.refresh_token })
        }
      }
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
    if (authView === 'create-account') {
      return (
        <CreateAccountScreen
          onBack={() => setAuthView('login')}
          onSuccess={() => {
            setSignupSuccessMessage('Account created! Check your email to confirm your account, then sign in.')
            setAuthView('login')
          }}
        />
      )
    }
    return (
      <LoginScreen
        successMessage={signupSuccessMessage}
        onCreateAccount={() => {
          setSignupSuccessMessage(null)
          setAuthView('create-account')
        }}
      />
    )
  }

  return (
    <>
      <AppShellWithRealtime userId={session.user.id} />
      {offerBiometric && (
        <BiometricSetupModal
          username={offerBiometric.username}
          refreshToken={offerBiometric.refreshToken}
          onDone={() => setOfferBiometric(null)}
        />
      )}
    </>
  )
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
  const setProfile = useProfileStore((s) => s.setProfile)

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
        const [dirs, tasks, settings, links, profile] = await Promise.all([
          fetchDirectories(userId),
          fetchTasks(userId),
          fetchUserSettings(userId),
          fetchLinksForUser(userId),
          fetchProfile(userId),
        ])
        if (!cancelled) {
          let dirsToSet = dirs
          if (dirs.length === 0) {
            const seeded = await seedFirstProject(userId)
            if (!cancelled) dirsToSet = seeded
          }
          if (!cancelled) {
            setDirectories(dirsToSet)
            setTasks(tasks)
            setLinks(links)
            setProfile(profile)
            if (settings) {
              setSettings(settings)
              setMode(settings.theme)
              setAccent(settings.accent)
            }
            const archived = await autoArchiveCompletedOlderThan5Days(userId, tasks)
            if (!cancelled) archived.forEach((t) => upsertTask(t))
          }
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
