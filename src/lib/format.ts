export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

/** "today" in the user's timezone, as the YYYY-MM-DD string a <input type="date"> wants. */
export function todayISO(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < todayISO()
}

export function initials(first: string, last?: string | null): string {
  return `${first.charAt(0)}${last?.charAt(0) ?? ''}`.toUpperCase() || '?'
}

export function fullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ')
}
