import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  FeedbackContext,
  type ConfirmOptions,
  type FeedbackState,
  type Toast,
  type ToastTone,
} from './feedback'

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const nextId = useRef(0)

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++
    setToasts((all) => [...all, { id, tone, message }])
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4000)
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  const value = useMemo<FeedbackState>(() => ({ toast, confirm }), [toast, confirm])

  function settle(result: boolean) {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toasts. Bottom on desktop, top on mobile so the tab bar never covers them. */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4 sm:top-auto sm:right-4 sm:bottom-4 sm:left-auto sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-in-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg ${
              t.tone === 'success'
                ? 'border-ok-ink/25 bg-ok-soft text-ok-ink'
                : t.tone === 'error'
                  ? 'border-danger/30 bg-danger-soft text-danger-ink'
                  : 'border-info-ink/25 bg-info-soft text-info-ink'
            }`}
          >
            <ToastIcon tone={t.tone} />
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {pending && (
        <div className="animate-fade fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50 backdrop-blur-[2px]"
            onClick={() => settle(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title}
            className="bg-surface animate-in-up relative w-full max-w-sm rounded-2xl p-5 shadow-2xl"
          >
            <h2 className="text-ink text-base font-semibold">{pending.title}</h2>
            <p className="text-muted mt-1.5 text-sm">{pending.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => settle(false)}>
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                className={pending.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  const path =
    tone === 'success'
      ? 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z'
      : tone === 'error'
        ? 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-12v5H9V6h2Zm0 6v2H9v-2h2Z'
        : 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-4v-5h2v5H9Zm0-7V5h2v2H9Z'
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-px h-4 w-4 shrink-0">
      <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
  )
}
