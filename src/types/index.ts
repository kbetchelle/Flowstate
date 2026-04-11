/**
 * Types matching spec §4 Data model.
 * No time_entries / timer (out of scope).
 */

export type TaskPriority = 'LOW' | 'MED' | 'HIGH'

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'finishing_touches'
  | 'completed'

export interface ChecklistItem {
  id: string
  text: string
  is_completed: boolean
  position: number
}

export interface Task {
  id: string
  title: string
  directory_id: string | null
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  background_color: string | null
  category: string | null
  tags: string[]
  description: string
  is_completed: boolean
  completed_at: string | null
  status: TaskStatus
  archived_at: string | null
  archive_reason: string | null
  position: number
  recurrence_frequency: string | null
  recurrence_interval: number | null
  recurrence_end_date: string | null
  /** Parsed/validated shape. When reading from DB, use parseChecklistItems(row.checklist_items). */
  checklist_items: ChecklistItem[]
  estimated_duration_minutes: number | null
  actual_duration_minutes: number | null
  url: string | null
  version: number
  user_id: string
  created_at: string
  updated_at: string
}

/** Raw task row from DB. checklist_items is JSONB — use parseTask() or parseChecklistItems() for type safety. */
export type TaskRow = Omit<Task, 'checklist_items'> & { checklist_items: unknown }

export interface Directory {
  id: string
  name: string
  parent_id: string | null
  position: number
  depth_level: number
  user_id: string
  version: number
  created_at: string
  updated_at: string
}

export type TaskLinkType = 'reference' | 'dependency'

export interface TaskLink {
  id: string
  source_id: string
  target_id: string
  link_type: TaskLinkType
  user_id: string
  created_at: string
  updated_at: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface UserSettings {
  user_id: string
  theme: ThemeMode
  accent: string | null
  /** Parsed/validated shape. When reading from DB, use parseCustomShortcuts(row.custom_shortcuts). */
  custom_shortcuts: Record<string, string>
  created_at: string
  updated_at: string
}

/** Raw user_settings row from DB. custom_shortcuts is JSONB — use parseUserSettings() or parseCustomShortcuts() for type safety. */
export type UserSettingsRow = Omit<UserSettings, 'custom_shortcuts'> & { custom_shortcuts: unknown }

/** Minimal shape for filters; extend as needed. */
export interface FilterState {
  showCompleted?: boolean
  colorMode?: 'none' | 'category' | 'priority'
}

/** View state only (no URL routing per spec). */
export type CurrentView = 'main_db' | 'upcoming' | 'archive' | 'settings'

export interface Profile {
  user_id: string
  username: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  contact_email: string | null
  date_of_birth: string | null  // ISO "YYYY-MM-DD" or null
  gender: string | null
  created_at: string
  updated_at: string
}
