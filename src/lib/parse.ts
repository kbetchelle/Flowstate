/**
 * Parse and validate JSONB-backed fields from the database.
 * Use these when hydrating Task / UserSettings from Supabase so we don't
 * assume structure the DB doesn't enforce.
 */

import type { ChecklistItem, Task, TaskRow, UserSettings, UserSettingsRow } from '../types'

/** Parse checklist_items JSONB into typed ChecklistItem[]. */
export function parseChecklistItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  const result: ChecklistItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (item === null || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : String(i)
    const text = typeof obj.text === 'string' ? obj.text : ''
    const is_completed = typeof obj.is_completed === 'boolean' ? obj.is_completed : false
    const position = typeof obj.position === 'number' && Number.isFinite(obj.position) ? obj.position : i
    result.push({ id, text, is_completed, position })
  }
  return result
}

/** Parse custom_shortcuts JSONB into Record<string, string>. */
export function parseCustomShortcuts(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, string> = {}
  const obj = raw as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (typeof value === 'string') result[key] = value
  }
  return result
}

/** Hydrate a raw task row from the DB into a typed Task. */
export function parseTask(row: TaskRow): Task {
  return {
    ...row,
    checklist_items: parseChecklistItems(row.checklist_items),
  }
}

/** Hydrate a raw user_settings row from the DB into typed UserSettings. */
export function parseUserSettings(row: UserSettingsRow): UserSettings {
  return {
    ...row,
    custom_shortcuts: parseCustomShortcuts(row.custom_shortcuts),
  }
}
