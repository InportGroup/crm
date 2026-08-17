import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** "sheet" slides up from the bottom on mobile; "side" is a right-hand drawer. */
  variant?: 'sheet' | 'side'
}

export function Modal({ open, title, onClose, children, footer, variant = 'sheet' }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const shell =
    variant === 'side'
      ? 'sm:ml-auto sm:h-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl'
      : 'sm:max-w-lg sm:rounded-2xl'

  return (
    <div
      className={`animate-fade fixed inset-0 z-60 flex ${
        variant === 'side' ? 'items-end sm:items-stretch' : 'items-end sm:items-center'
      } justify-center sm:p-4`}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface animate-in-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl shadow-2xl ${shell}`}
      >
        {/* Grab handle: signals the sheet is dismissable on touch. */}
        <div className="bg-line-strong mx-auto mt-2.5 h-1 w-9 rounded-full sm:hidden" />

        <header className="border-line flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-ink text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-subtle hover:bg-neutral-soft hover:text-ink rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.3 6.3a1 1 0 0 1 1.4 0L10 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 10l2.3 2.3a1 1 0 0 1-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 10 6.3 7.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="border-line bg-canvas flex justify-end gap-2 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
