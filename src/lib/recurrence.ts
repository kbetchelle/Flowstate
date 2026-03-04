/**
 * Recurrence: compute next occurrence date when a recurring task is completed.
 * Spec §4, Q58; Phase 14.
 */

import type { Task } from '../types'

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const

function addDays(date: Date, days: number): Date {
  const out = new Date(date)
  out.setDate(out.getDate() + days)
  return out
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date)
  out.setMonth(out.getMonth() + months)
  return out
}

function addYears(date: Date, years: number): Date {
  const out = new Date(date)
  out.setFullYear(out.getFullYear() + years)
  return out
}

/**
 * Compute the next occurrence due date (and start date) for a completed recurring task.
 * Returns null if no recurrence is set, or if the next occurrence would be after end date.
 */
export function getNextOccurrenceDates(task: Task): {
  due_date: string | null
  start_date: string | null
} | null {
  const freq = task.recurrence_frequency?.toLowerCase()?.trim()
  if (!freq || !FREQUENCIES.includes(freq as (typeof FREQUENCIES)[number])) {
    return null
  }
  const interval = Math.max(1, task.recurrence_interval ?? 1)
  const baseDue = task.due_date ? new Date(task.due_date) : new Date()
  const baseStart = task.start_date ? new Date(task.start_date) : null
  const endDate = task.recurrence_end_date ? new Date(task.recurrence_end_date) : null

  let nextDue: Date
  switch (freq) {
    case 'daily':
      nextDue = addDays(baseDue, interval)
      break
    case 'weekly':
      nextDue = addWeeks(baseDue, interval)
      break
    case 'monthly':
      nextDue = addMonths(baseDue, interval)
      break
    case 'yearly':
      nextDue = addYears(baseDue, interval)
      break
    default:
      return null
  }

  if (endDate != null && nextDue > endDate) {
    return null
  }

  const nextStart =
    baseStart != null
      ? (() => {
          const deltaMs = baseDue.getTime() - baseStart.getTime()
          const nextStartDate = new Date(nextDue.getTime() - deltaMs)
          return nextStartDate.toISOString().slice(0, 10)
        })()
      : null

  return {
    due_date: nextDue.toISOString().slice(0, 10),
    start_date: nextStart,
  }
}

/**
 * Whether the task has recurrence configured (so completing it should create next occurrence).
 */
export function hasRecurrence(task: Task): boolean {
  const freq = task.recurrence_frequency?.toLowerCase()?.trim()
  return Boolean(freq && FREQUENCIES.includes(freq as (typeof FREQUENCIES)[number]))
}
