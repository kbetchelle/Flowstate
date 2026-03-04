/**
 * Settings view: theme, accent, shortcut remapping. Persisted to user_settings.
 * Spec §5, Phase 12.
 */

import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { fetchUserSettings, upsertUserSettings } from '../api/userSettings'
import { REMAPPABLE_ACTIONS, keyEventToCombo } from '../constants/shortcuts'
import type { ThemeMode } from '../types'

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function SettingsView() {
  const userId = useAuthStore((s) => s.user?.id)
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)
  const setSettings = useSettingsStore((s) => s.setSettings)

  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>({})
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    } finally {
      setSaving(false)
    }
  }

  const getDisplayKeys = (actionId: string, defaultKeys: string) =>
    customShortcuts[actionId] ?? defaultKeys

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>Settings</h2>

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
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          />
          <input
            type="color"
            value={accent ?? '#1976d2'}
            onChange={(e) => setAccent(e.target.value)}
            style={{ width: 36, height: 36, padding: 0, border: '1px solid #ddd', cursor: 'pointer' }}
          />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Keyboard shortcuts</h3>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: 14 }}>
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
                borderBottom: '1px solid #eee',
              }}
            >
              <span style={{ flex: 1, fontSize: 14 }}>{action.label}</span>
              <code
                style={{
                  minWidth: 140,
                  padding: '4px 8px',
                  fontSize: 13,
                  background: recordingId === action.id ? '#fff3e0' : '#f5f5f5',
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
                  style={{ padding: '4px 8px', fontSize: 12, color: '#666' }}
                >
                  Reset
                </button>
              )}
            </div>
          ))}
        </div>
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
        {saved && <span style={{ color: '#2e7d32', fontSize: 14 }}>Saved</span>}
      </div>
    </div>
  )
}
