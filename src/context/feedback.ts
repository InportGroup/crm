import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'brand'
}

export interface FeedbackState {
  toast: (message: string, tone?: ToastTone) => void
  /** Resolves true if the user confirms, false if they dismiss. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export const FeedbackContext = createContext<FeedbackState | null>(null)

export function useFeedback(): FeedbackState {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return ctx
}
