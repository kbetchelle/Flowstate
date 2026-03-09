/**
 * Toast notifications from feedbackStore. Auto-dismiss after 4s (Phase 16).
 * On mobile, bottom offset accounts for bottom nav (56px).
 */

import { useEffect, useState } from 'react'
import { useFeedbackStore } from '../stores/feedbackStore'

const AUTO_DISMISS_MS = 4000
const BOTTOM_NAV_HEIGHT = 56
const TOAST_MARGIN = 24

export function FeedbackToast() {
  const toasts = useFeedbackStore((s) => s.toasts)
  const removeToast = useFeedbackStore((s) => s.removeToast)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const listener = () => setIsMobile(mq.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])
  const bottom = isMobile ? BOTTOM_NAV_HEIGHT + TOAST_MARGIN : TOAST_MARGIN

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: { id: string; type: 'success' | 'error' | 'info'; message: string }
  onRemove: (id: string) => void
}) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [toast.id, onRemove])

  const bg =
    toast.type === 'error'
      ? 'var(--toast-error-bg)'
      : toast.type === 'success'
        ? 'var(--toast-success-bg)'
        : 'var(--toast-info-bg)'
  const color =
    toast.type === 'error'
      ? 'var(--color-error)'
      : toast.type === 'success'
        ? 'var(--color-success)'
        : 'var(--color-info)'

  return (
    <div
      role="status"
      className="glass-surface"
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        backgroundColor: bg,
        color,
        fontSize: 14,
        boxShadow: 'var(--glass-shadow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'inherit',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
