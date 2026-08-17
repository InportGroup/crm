import type { ReactNode } from 'react'
import type { ContactStatus, DealStage, Priority } from '../lib/types'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-ink text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-subtle mt-1 block text-xs">{hint}</span>}
    </label>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="bg-brand-soft text-brand flex h-12 w-12 items-center justify-center rounded-full">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
        </svg>
      </div>
      <div>
        <p className="text-ink font-medium">{title}</p>
        <p className="text-muted mx-auto mt-1 max-w-sm text-sm">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="text-muted flex items-center justify-center gap-3 py-16 text-sm">
      <span className="border-line-strong border-t-brand h-4 w-4 animate-spin rounded-full border-2" />
      {label}
    </div>
  )
}

/** Shimmering placeholder rows, so lists don't pop in from nothing. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card divide-line divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="bg-neutral-soft h-9 w-9 shrink-0 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-neutral-soft h-3 w-1/3 animate-pulse rounded" />
            <div className="bg-neutral-soft h-2.5 w-1/5 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="border-danger/30 bg-danger-soft text-danger-ink rounded-lg border px-3 py-2 text-sm">
      {message}
    </p>
  )
}

const STATUS_STYLES: Record<ContactStatus, string> = {
  lead: 'bg-neutral-soft text-neutral-ink',
  prospect: 'bg-warn-soft text-warn-ink',
  customer: 'bg-ok-soft text-ok-ink',
  churned: 'bg-danger-soft text-danger-ink',
}

export function StatusBadge({ status }: { status: ContactStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>
}

const STAGE_STYLES: Record<DealStage, string> = {
  new: 'bg-neutral-soft text-neutral-ink',
  qualified: 'bg-info-soft text-info-ink',
  proposal: 'bg-brand-soft text-brand-ink',
  negotiation: 'bg-warn-soft text-warn-ink',
  won: 'bg-ok-soft text-ok-ink',
  lost: 'bg-danger-soft text-danger-ink',
}

export function StageBadge({ stage }: { stage: DealStage }) {
  return <span className={`badge ${STAGE_STYLES[stage]}`}>{stage}</span>
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-neutral-soft text-neutral-ink',
  medium: 'bg-info-soft text-info-ink',
  high: 'bg-danger-soft text-danger-ink',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority]}`}>{priority}</span>
}

/** Deterministic avatar tint, so a given person keeps the same colour. */
const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
]

export function Avatar({
  initials,
  seed = '',
  size = 'md',
}: {
  initials: string
  seed?: string
  size?: 'sm' | 'md'
}) {
  let hash = 0
  for (const ch of seed) hash = (hash + ch.charCodeAt(0)) % AVATAR_TINTS.length
  const dimensions = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-xs'
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dimensions} ${AVATAR_TINTS[hash]}`}
    >
      {initials}
    </span>
  )
}
