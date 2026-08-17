import { useMemo, useState, type FormEvent } from 'react'
import {
  createVaultEntry,
  deleteVaultEntry,
  listCompanies,
  listVaultEntries,
  nullifyBlanks,
  updateVaultEntry,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { formatDate } from '../lib/format'
import { VAULT_CATEGORIES, type Company, type VaultCategory, type VaultEntry } from '../lib/types'
import { Modal } from '../components/Modal'
import { Avatar, EmptyState, ErrorNote, Field, PageHeader, SkeletonList } from '../components/ui'

interface Data {
  entries: VaultEntry[]
  companies: Company[]
}

export function Vault() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [entries, companies] = await Promise.all([listVaultEntries(), listCompanies()])
    return { entries, companies }
  })

  const { toast, confirm } = useFeedback()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<VaultCategory | 'all'>('all')
  const [editing, setEditing] = useState<VaultEntry | 'new' | null>(null)
  /** Ids currently revealed. Cleared on every reload so nothing stays exposed. */
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const visible = useMemo(() => {
    const entries = data?.entries ?? []
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (!q) return true
      return [e.title, e.username, e.url, e.notes]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    })
  }, [data, search, categoryFilter])

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copied.`)
    } catch {
      toast('Could not copy — the browser blocked clipboard access.', 'error')
    }
  }

  async function onDelete(entry: VaultEntry) {
    const ok = await confirm({
      title: `Delete “${entry.title}”?`,
      message: 'The stored credential is removed for everyone. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await deleteVaultEntry(entry.id)
    setRevealed(new Set())
    reload()
    toast('Entry deleted.')
  }

  return (
    <>
      <PageHeader
        title="Passwords"
        subtitle="Shared team credentials"
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New entry
          </button>
        }
      />

      {/* Deliberately permanent: the storage trade-off should stay visible to
          whoever is adding credentials, not be buried in a commit message. */}
      <div className="border-warn-ink/30 bg-warn-soft text-warn-ink mb-5 flex gap-3 rounded-xl border px-4 py-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0">
          <path d="M10 2 1 18h18L10 2Zm1 12H9v2h2v-2Zm0-6H9v5h2V8Z" />
        </svg>
        <div className="text-sm">
          <p className="font-semibold">Stored without encryption</p>
          <p className="mt-0.5 opacity-90">
            Anyone who can sign in to IPG-CRM can read these, and so can anyone with database
            access. Avoid banking, payment or domain-registrar logins here.
          </p>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <SkeletonList />
      ) : data && data.entries.length === 0 ? (
        <EmptyState
          title="No credentials stored"
          description="Keep shared logins — carrier portals, a shared inbox — where the team can find them."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New entry
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input sm:max-w-xs"
              placeholder="Search credentials…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
                All
              </Chip>
              {VAULT_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  active={categoryFilter === c}
                  onClick={() => setCategoryFilter(c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <ul className="grid gap-2">
            {visible.map((entry) => {
              const shown = revealed.has(entry.id)
              return (
                <li key={entry.id} className="card min-w-0 p-4">
                  {/* min-w-0 on both the row and the text column: without it the
                      fixed-width action buttons push the card past the viewport
                      on narrow screens instead of the text truncating. */}
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar initials={entry.title.slice(0, 2).toUpperCase()} seed={entry.id} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-ink truncate text-sm font-medium">{entry.title}</p>
                        <span className="badge bg-neutral-soft text-neutral-ink capitalize">
                          {entry.category}
                        </span>
                      </div>

                      {entry.url && (
                        <a
                          href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand text-xs hover:underline"
                        >
                          {entry.url}
                        </a>
                      )}

                      {entry.username && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-subtle w-16 shrink-0 text-xs">User</span>
                          <code className="text-ink min-w-0 flex-1 truncate text-xs">
                            {entry.username}
                          </code>
                          <IconBtn
                            label="Copy username"
                            onClick={() => void copy(entry.username!, 'Username')}
                            path="M7 3h7a2 2 0 0 1 2 2v9h-2V5H7V3Zm-3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                          />
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-subtle w-16 shrink-0 text-xs">Password</span>
                        <code className="text-ink min-w-0 flex-1 truncate font-mono text-xs">
                          {shown ? entry.secret || '—' : '•'.repeat(12)}
                        </code>
                        <IconBtn
                          label={shown ? 'Hide password' : 'Reveal password'}
                          onClick={() => toggleReveal(entry.id)}
                          path={
                            shown
                              ? 'M3.3 2.3 2 3.6l2.3 2.3A9.6 9.6 0 0 0 1 10s3 6 9 6c1.4 0 2.7-.3 3.8-.9l2.6 2.6 1.3-1.3L3.3 2.3ZM10 14c-3.7 0-6-3-6.8-4a8 8 0 0 1 2.5-2.6l1.6 1.6A3 3 0 0 0 10 13c.3 0 .6 0 .9-.1l1 1c-.6.1-1.2.1-1.9.1Zm8.9-4S16 4 10 4c-.7 0-1.4.1-2 .2l1.7 1.7H10a3 3 0 0 1 3 3v.3l2.4 2.4A9.7 9.7 0 0 0 19 10Z'
                              : 'M10 4c-6 0-9 6-9 6s3 6 9 6 9-6 9-6-3-6-9-6Zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'
                          }
                        />
                        <IconBtn
                          label="Copy password"
                          onClick={() => void copy(entry.secret, 'Password')}
                          path="M7 3h7a2 2 0 0 1 2 2v9h-2V5H7V3Zm-3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                        />
                      </div>

                      {(entry.company_id || entry.notes) && (
                        <p className="text-subtle mt-2 text-xs">
                          {entry.company_id && companyNames.get(entry.company_id)}
                          {entry.company_id && entry.notes && ' · '}
                          {entry.notes}
                        </p>
                      )}

                      <p className="text-subtle mt-1 text-[11px]">
                        Updated {formatDate(entry.updated_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1"
                        onClick={() => setEditing(entry)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-danger px-2 py-1"
                        onClick={() => void onDelete(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {visible.length === 0 && (
            <p className="text-muted py-10 text-center text-sm">No entries match your filters.</p>
          )}
        </>
      )}

      {editing && (
        <VaultForm
          entry={editing === 'new' ? null : editing}
          companies={data?.companies ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setRevealed(new Set())
            reload()
            toast('Entry saved.')
          }}
        />
      )}
    </>
  )
}

function IconBtn({
  label,
  onClick,
  path,
}: {
  label: string
  onClick: () => void
  path: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-subtle hover:bg-neutral-soft hover:text-ink shrink-0 rounded p-1 transition-colors"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d={path} />
      </svg>
    </button>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
        active ? 'bg-brand text-white' : 'bg-neutral-soft text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function VaultForm({
  entry,
  companies,
  onClose,
  onSaved,
}: {
  entry: VaultEntry | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: entry?.title ?? '',
    username: entry?.username ?? '',
    secret: entry?.secret ?? '',
    url: entry?.url ?? '',
    category: entry?.category ?? ('other' as VaultCategory),
    company_id: entry?.company_id ?? '',
    notes: entry?.notes ?? '',
  })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  function generate() {
    // Crypto-strong random password, avoiding ambiguous characters.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+'
    const bytes = new Uint32Array(20)
    crypto.getRandomValues(bytes)
    const generated = [...bytes].map((n) => alphabet[n % alphabet.length]).join('')
    set('secret', generated)
    setShow(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      // secret is NOT NULL with a '' default, so keep it a string rather than
      // letting nullifyBlanks turn an empty field into NULL.
      const { secret, ...rest } = form
      const values = { ...nullifyBlanks(rest), secret, secret_encrypted: false }
      if (entry) await updateVaultEntry(entry.id, values)
      else await createVaultEntry(values)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the entry.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={entry ? 'Edit entry' : 'New entry'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="vault-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </>
      }
    >
      <form id="vault-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Field label="Title">
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Maersk carrier portal"
            required
          />
        </Field>

        <Field label="Username or email">
          <input
            className="input"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            autoComplete="off"
          />
        </Field>

        <Field label="Password">
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              className="input font-mono"
              value={form.secret}
              onChange={(e) => set('secret', e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
            <button type="button" className="btn-secondary shrink-0" onClick={generate}>
              Generate
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="URL">
            <input
              className="input"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="portal.maersk.com"
            />
          </Field>
          <Field label="Category">
            <select
              className="input capitalize"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {VAULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Company">
          <select
            className="input"
            value={form.company_id}
            onChange={(e) => set('company_id', e.target.value)}
          >
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes" hint="Do not store recovery codes or security answers here.">
          <textarea
            className="input min-h-20"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
