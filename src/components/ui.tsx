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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
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
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}

const STATUS_STYLES: Record<ContactStatus, string> = {
  lead: 'bg-slate-100 text-slate-700',
  prospect: 'bg-amber-100 text-amber-800',
  customer: 'bg-emerald-100 text-emerald-800',
  churned: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: ContactStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>
}

const STAGE_STYLES: Record<DealStage, string> = {
  new: 'bg-slate-100 text-slate-700',
  qualified: 'bg-sky-100 text-sky-800',
  proposal: 'bg-violet-100 text-violet-800',
  negotiation: 'bg-amber-100 text-amber-800',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-700',
}

export function StageBadge({ stage }: { stage: DealStage }) {
  return <span className={`badge ${STAGE_STYLES[stage]}`}>{stage}</span>
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-red-100 text-red-700',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority]}`}>{priority}</span>
}
