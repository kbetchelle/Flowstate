/**
 * First-run onboarding flow. Dismissible; show once per user/device (spec Q53).
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'

const ONBOARDING_KEY_PREFIX = 'flowstate_onboarding_done'

function getOnboardingKey(userId: string | undefined): string {
  return userId ? `${ONBOARDING_KEY_PREFIX}_${userId}` : ONBOARDING_KEY_PREFIX
}

function isOnboardingDone(userId: string | undefined): boolean {
  try {
    return localStorage.getItem(getOnboardingKey(userId)) === '1'
  } catch {
    return false
  }
}

function setOnboardingDone(userId: string | undefined): void {
  try {
    localStorage.setItem(getOnboardingKey(userId), '1')
  } catch (_) {}
}

const STEPS = [
  { title: 'Welcome to Flowstate', body: 'Your task and list app. Use the command palette to create tasks and switch views.' },
  { title: 'Quick start', body: 'Press Cmd+K (or Ctrl+K) anywhere to open the command palette. From there you can create a new task or directory, or switch to List, Calendar, or Kanban view.' },
  { title: "You're set", body: 'Explore the main view, try Cmd+Shift+E to open the full edit panel on a task, and use the Settings in the header to customize theme and shortcuts.' },
]

export function OnboardingFlow() {
  const userId = useAuthStore((s) => s.user?.id)
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(() => !isOnboardingDone(userId))

  useEffect(() => {
    if (userId != null && isOnboardingDone(userId)) setOpen(false)
  }, [userId])

  if (!open) return null

  const dismiss = () => {
    setOnboardingDone(userId)
    setOpen(false)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #fff)',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          maxWidth: 400,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="onboarding-title" style={{ margin: '0 0 12px', fontSize: 18 }}>
          {current.title}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
          {current.body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={dismiss}
            style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', color: '#666' }}
          >
            Skip
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={dismiss}
                style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
