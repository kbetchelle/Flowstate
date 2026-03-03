/**
 * Feedback store: toasts for success/error (save, delete, conflict resolved, etc.).
 */

import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

export interface FeedbackState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

let toastId = 0

export const useFeedbackStore = create<FeedbackState>((set) => ({
  toasts: [],
  addToast: (type, message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `toast-${++toastId}`, type, message },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
