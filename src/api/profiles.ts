/**
 * Profiles API: fetch and upsert.
 * username is excluded from the editable fields type — it is read-only after creation.
 */

import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as Profile
}

export async function upsertProfile(
  userId: string,
  username: string,
  profile: Partial<Omit<Profile, 'user_id' | 'username' | 'created_at' | 'updated_at'>>
): Promise<Profile> {
  const row = {
    user_id: userId,
    username, // included to satisfy NOT NULL constraint on the INSERT path
    ...profile,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data as Profile
}
