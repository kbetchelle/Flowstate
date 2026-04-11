/**
 * Settings view: theme, accent, shortcut remapping. Persisted to user_settings.
 * Spec §5, Phase 12.
 */

import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useProfileStore } from '../stores/profileStore'
import { fetchUserSettings, upsertUserSettings } from '../api/userSettings'
import { upsertProfile } from '../api/profiles'
import { supabase } from '../lib/supabase'
import { isBiometricSupported, getBiometricData, setupBiometric, clearBiometric } from '../lib/biometric'
import { REMAPPABLE_ACTIONS, keyEventToCombo } from '../constants/shortcuts'
import type { ThemeMode } from '../types'

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

interface SettingsViewProps {
  onClose?: () => void
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)
  const setSettings = useSettingsStore((s) => s.setSettings)

  // Profile store
  const profile = useProfileStore((s) => s.profile)
  const setProfile = useProfileStore((s) => s.setProfile)

  // Profile form state
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Biometric state
  const [biometricEnabled, setBiometricEnabled] = useState(() => !!getBiometricData())
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null)

  // App settings state
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>({})
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync profile form when the store loads (mirrors customShortcuts sync pattern)
  useEffect(() => {
    if (!profile) return
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setNickname(profile.nickname ?? '')
    setContactEmail(profile.contact_email ?? '')
    setDateOfBirth(profile.date_of_birth ?? '')
    setGender(profile.gender ?? '')
  }, [profile])

  useEffect(() => {
    if (!userId) return
    fetchUserSettings(userId).then((s) => {
      if (s) {
        setSettings(s)
        setMode(s.theme)
        setAccent(s.accent)
        setCustomShortcuts(s.custom_shortcuts ?? {})
      }
    })
  }, [userId, setSettings, setMode, setAccent])

  useEffect(() => {
    if (!recordingId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const combo = keyEventToCombo(e)
      setCustomShortcuts((prev) => ({ ...prev, [recordingId]: combo }))
      setRecordingId(null)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingId])

  const handleSaveProfile = async () => {
    if (!userId) return
    setProfileSaving(true)
    setProfileSaved(false)
    setProfileError(null)
    try {
      const updated = await upsertProfile(userId, profile?.username ?? '', {
        first_name: firstName || null,
        last_name: lastName || null,
        nickname: nickname || null,
        contact_email: contactEmail || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
      })
      setProfile(updated)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    if (!newPassword) { setPasswordError('New password is required.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return }
    setPasswordSaving(true)
    setPasswordSaved(false)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 2000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleEnableBiometric = async () => {
    setBiometricLoading(true)
    setBiometricMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    const refreshToken = session?.refresh_token
    const username = profile?.username ?? ''
    if (!refreshToken || !username) {
      setBiometricMessage('Unable to enable biometric: session not found.')
      setBiometricLoading(false)
      return
    }
    const ok = await setupBiometric(username, refreshToken)
    setBiometricLoading(false)
    if (ok) {
      setBiometricEnabled(true)
      setBiometricMessage('Biometric login enabled.')
      setTimeout(() => setBiometricMessage(null), 2000)
    } else {
      setBiometricMessage('Biometric setup failed. This feature may not be supported on your browser.')
    }
  }

  const handleDisableBiometric = () => {
    clearBiometric()
    setBiometricEnabled(false)
    setBiometricMessage('Biometric login disabled.')
    setTimeout(() => setBiometricMessage(null), 2000)
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    setSaved(false)
    try {
      const updated = await upsertUserSettings(userId, {
        theme: mode,
        accent,
        custom_shortcuts: customShortcuts,
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  const getDisplayKeys = (actionId: string, defaultKeys: string) =>
    customShortcuts[actionId] ?? defaultKeys

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Settings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onClose && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontSize: 18,
                  lineHeight: 1,
                  color: 'var(--text-secondary)',
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Theme</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {THEMES.map((t) => (
            <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={mode === t.value}
                onChange={() => setMode(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Accent color</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            value={accent ?? ''}
            onChange={(e) => setAccent(e.target.value || null)}
            placeholder="#1976d2"
            style={{
              width: 120,
              padding: '8px 10px',
              fontSize: 14,
              border: '1px solid var(--input-border)',
              borderRadius: 4,
            }}
          />
          <input
            type="color"
            value={accent ?? '#1976d2'}
            onChange={(e) => setAccent(e.target.value)}
            style={{ width: 36, height: 36, padding: 0, border: '1px solid var(--input-border)', cursor: 'pointer' }}
          />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Keyboard shortcuts</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
          Click &quot;Set&quot; then press the key combination you want.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REMAPPABLE_ACTIONS.map((action) => (
            <div
              key={action.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <span style={{ flex: 1, fontSize: 14 }}>{action.label}</span>
              <code
                style={{
                  minWidth: 140,
                  padding: '4px 8px',
                  fontSize: 13,
                  background: recordingId === action.id ? 'var(--highlight-bg)' : 'var(--glass-bg)',
                  borderRadius: 4,
                }}
              >
                {recordingId === action.id ? 'Press key…' : getDisplayKeys(action.id, action.defaultKeys)}
              </code>
              <button
                type="button"
                onClick={() => setRecordingId(action.id)}
                style={{ padding: '4px 12px', fontSize: 13 }}
              >
                Set
              </button>
              {customShortcuts[action.id] !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    setCustomShortcuts((prev) => {
                      const next = { ...prev }
                      delete next[action.id]
                      return next
                    })
                  }
                  style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)' }}
                >
                  Reset
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Profile</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4, color: 'var(--text-secondary)' }}>
            Username
          </label>
          <input
            type="text"
            value={profile?.username ?? ''}
            readOnly
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              fontSize: 14,
              boxSizing: 'border-box',
              border: '1px solid var(--input-border)',
              borderRadius: 4,
              background: 'var(--highlight-bg)',
              color: 'var(--text-secondary)',
              cursor: 'default',
            }}
          />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Your username is your login identifier and cannot be changed.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What you'd like to be called"
            style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
          />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Optional. Used for notifications only, not for login.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Gender</label>
            <input
              type="text"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Optional, free text"
              style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={profileSaving}
            style={{ padding: '10px 20px', fontSize: 14 }}
          >
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
          {profileSaved && <span style={{ color: 'var(--color-success)', fontSize: 14 }}>Saved</span>}
          {profileError && <span style={{ color: 'var(--color-error)', fontSize: 14 }}>{profileError}</span>}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Account</h3>

        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Change password</h4>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 4 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={passwordSaving}
            style={{ padding: '10px 20px', fontSize: 14 }}
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </button>
          {passwordSaved && <span style={{ color: 'var(--color-success)', fontSize: 14 }}>Password updated</span>}
          {passwordError && <span style={{ color: 'var(--color-error)', fontSize: 14 }}>{passwordError}</span>}
        </div>

        {isBiometricSupported() && (
          <>
            <div style={{ width: '100%', height: 1, background: 'var(--divider)', marginBottom: 16 }} />
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Biometric login</h4>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>
              {biometricEnabled
                ? 'Biometric login is enabled. You can sign in using Face ID, Touch ID, or your device fingerprint sensor.'
                : 'Enable biometric login to sign in faster using Face ID, Touch ID, or your device fingerprint sensor.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {biometricEnabled ? (
                <button
                  type="button"
                  onClick={handleDisableBiometric}
                  disabled={biometricLoading}
                  style={{ padding: '10px 20px', fontSize: 14 }}
                >
                  Disable biometric login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableBiometric}
                  disabled={biometricLoading}
                  style={{ padding: '10px 20px', fontSize: 14 }}
                >
                  {biometricLoading ? 'Setting up…' : 'Enable biometric login'}
                </button>
              )}
              {biometricMessage && (
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{biometricMessage}</span>
              )}
            </div>
          </>
        )}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 20px', fontSize: 14 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 14 }}>Saved</span>}
      </div>
    </div>
  )
}
