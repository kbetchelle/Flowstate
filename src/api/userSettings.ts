/**
 * User settings API: fetch, upsert.
 * Spec §4 user_settings.
 */

import { supabase } from '../lib/supabase'
import { parseUserSettings } from '../lib/parse'
import type { UserSettings, UserSettingsRow } from '../types'

export async function fetchUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return parseUserSettings(data as UserSettingsRow)
}

export async function upsertUserSettings(
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserSettings> {
  const row = {
    user_id: userId,
    ...settings,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return parseUserSettings(data as UserSettingsRow)
}
