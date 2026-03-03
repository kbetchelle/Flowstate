/**
 * Attachments API for task attachments (panel only per spec §7 Q49).
 * Storage bucket: task-attachments; path: {user_id}/{task_id}/{filename}.
 */

import { supabase } from '../lib/supabase'

const BUCKET = 'task-attachments'

export async function uploadAttachment(
  userId: string,
  taskId: string,
  file: File
): Promise<{ path: string }> {
  const path = `${userId}/${taskId}/${file.name}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
  })
  if (error) throw error
  return { path }
}

export async function getAttachmentUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (!data?.signedUrl) throw new Error('Failed to create signed URL')
  return data.signedUrl
}

export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export async function listAttachments(
  userId: string,
  taskId: string
): Promise<{ name: string; path: string }[]> {
  const folderPath = `${userId}/${taskId}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folderPath, { limit: 100 })
  if (error) throw error
  const files = data?.filter((f) => f.name && !f.id) ?? []
  return files.map((f) => ({
    name: f.name!,
    path: `${folderPath}/${f.name}`,
  }))
}
