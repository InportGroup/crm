import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCompanies, listContacts, listDeals, listExpenses, listVaultEntries } from '../lib/api'
import { formatCurrency, formatDate, fullName, initials } from '../lib/format'
import { Avatar } from './ui'

interface Hit {
  id: string
  kind: 'Contact' | 'Company' | 'Deal' | 'Expense' | 'Password'
  label: string
  detail: string
  to: string
  initials: string
}

/**
 * Global search over the three record types. Results are loaded once when the
 * palette opens and filtered in memory — with a few thousand rows that is far
 * snappier than a round-trip per keystroke.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    setLoading(true)

    let cancelled = false
    Promise.all([
      listContacts(),
      listCompanies(),
      listDeals(),
      listExpenses(),
      listVaultEntries(),
    ])
      .then(([contacts, companies, deals, expenses, vault]) => {
        if (cancelled) return
        const companyNames = new Map(companies.map((c) => [c.id, c.name]))
        setHits([
          ...contacts.map<Hit>((c) => ({
            id: `contact-${c.id}`,
            kind: 'Contact',
            label: fullName(c.first_name, c.last_name),
            detail: [c.job_title, c.company_id ? companyNames.get(c.company_id) : c.email]
              .filter(Boolean)
              .join(' · '),
            to: '/contacts',
            initials: initials(c.first_name, c.last_name),
          })),
          ...companies.map<Hit>((c) => ({
            id: `company-${c.id}`,
            kind: 'Company',
            label: c.name,
            detail: [c.industry, c.domain].filter(Boolean).join(' · '),
            to: '/companies',
            initials: c.name.slice(0, 2).toUpperCase(),
          })),
          ...deals.map<Hit>((d) => ({
            id: `deal-${d.id}`,
            kind: 'Deal',
            label: d.title,
            detail: `${formatCurrency(Number(d.value), d.currency)} · ${d.stage}`,
            to: '/deals',
            initials: d.title.slice(0, 2).toUpperCase(),
          })),
          ...expenses.map<Hit>((e) => ({
            id: `expense-${e.id}`,
            kind: 'Expense',
            label: e.description,
            detail: `${formatCurrency(Number(e.amount), e.currency)} · ${formatDate(e.spent_on)}`,
            to: '/expenses',
            initials: e.description.slice(0, 2).toUpperCase(),
          })),
          // Titles and usernames only — secrets never enter the search index.
          ...vault.map<Hit>((v) => ({
            id: `vault-${v.id}`,
            kind: 'Password',
            label: v.title,
            detail: [v.username, v.category].filter(Boolean).join(' · '),
            to: '/vault',
            initials: v.title.slice(0, 2).toUpperCase(),
          })),
        ])
      })
      .catch(() => setHits([]))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return hits.slice(0, 8)
    return hits
      .filter((h) => `${h.label} ${h.detail}`.toLowerCase().includes(q))
      .slice(0, 12)
  }, [hits, query])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  function choose(hit: Hit | undefined) {
    if (!hit) return
    navigate(hit.to)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    }
  }

  return (
    <div className="animate-fade fixed inset-0 z-70 flex items-start justify-center p-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="bg-surface animate-in-up relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div className="border-line flex items-center gap-3 border-b px-4">
          <svg viewBox="0 0 20 20" fill="currentColor" className="text-subtle h-4 w-4 shrink-0">
            <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.8l3.4 3.4a1 1 0 0 0 1.4-1.4l-3.4-3.4A5.5 5.5 0 0 0 8.5 3Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search contacts, companies and deals…"
            className="text-ink placeholder:text-subtle flex-1 bg-transparent py-3.5 text-sm outline-none"
          />
          <kbd className="border-line bg-canvas text-subtle hidden rounded border px-1.5 py-0.5 font-sans text-[10px] sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && <p className="text-muted px-3 py-6 text-center text-sm">Loading…</p>}

          {!loading && results.length === 0 && (
            <p className="text-muted px-3 py-6 text-center text-sm">
              {query ? `Nothing matches “${query}”.` : 'No records yet.'}
            </p>
          )}

          {results.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(hit)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                i === active ? 'bg-brand-soft' : ''
              }`}
            >
              <Avatar initials={hit.initials} seed={hit.label} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-sm font-medium">{hit.label}</span>
                {hit.detail && (
                  <span className="text-subtle block truncate text-xs">{hit.detail}</span>
                )}
              </span>
              <span className="badge bg-neutral-soft text-neutral-ink">{hit.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
