import { useMemo, useState, type FormEvent } from 'react'
import {
  createContact,
  deleteContact,
  listCompanies,
  listContacts,
  listDeals,
  listTasks,
  nullifyBlanks,
  updateContact,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { formatCurrency, formatDate, fullName, initials } from '../lib/format'
import {
  CONTACT_STATUSES,
  type Company,
  type Contact,
  type ContactStatus,
  type Deal,
  type Task,
} from '../lib/types'
import { Modal } from '../components/Modal'
import { ActivityFeed } from '../components/ActivityFeed'
import {
  Avatar,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  SkeletonList,
  StatusBadge,
} from '../components/ui'

interface Data {
  contacts: Contact[]
  companies: Company[]
  deals: Deal[]
  tasks: Task[]
}

export function Contacts() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [contacts, companies, deals, tasks] = await Promise.all([
      listContacts(),
      listCompanies(),
      listDeals(),
      listTasks(),
    ])
    return { contacts, companies, deals, tasks }
  })

  const { toast, confirm } = useFeedback()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)
  const [viewing, setViewing] = useState<Contact | null>(null)

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const visible = useMemo(() => {
    const contacts = data?.contacts ?? []
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return [
        fullName(c.first_name, c.last_name),
        c.email,
        c.phone,
        c.job_title,
        c.company_id ? companyNames.get(c.company_id) : '',
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    })
  }, [data, search, statusFilter, companyNames])

  async function onDelete(contact: Contact) {
    const ok = await confirm({
      title: `Delete ${fullName(contact.first_name, contact.last_name)}?`,
      message: 'Their activity and tasks go too. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteContact(contact.id)
      setViewing(null)
      reload()
      toast('Contact deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${data?.contacts.length ?? 0} people`}
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            <PlusIcon />
            New contact
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {loading ? (
        <SkeletonList />
      ) : data && data.contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the first person you are talking to. Everyone on the team sees the same list."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New contact
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input sm:max-w-xs"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {/* min-w-0 lets this flex child shrink; without it the scroll strip
                forces the whole page wider than the viewport on mobile. */}
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                All
              </FilterChip>
              {CONTACT_STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Mobile: cards. A 6-column table is unusable at 375px. */}
          <div className="grid gap-2 md:hidden">
            {visible.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setViewing(contact)}
                className="rowcard flex w-full min-w-0 items-center gap-3 text-left"
              >
                <Avatar
                  initials={initials(contact.first_name, contact.last_name)}
                  seed={contact.id}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm font-medium">
                    {fullName(contact.first_name, contact.last_name)}
                  </p>
                  <p className="text-subtle truncate text-xs">
                    {[contact.job_title, contact.company_id && companyNames.get(contact.company_id)]
                      .filter(Boolean)
                      .join(' · ') || contact.email}
                  </p>
                </div>
                <StatusBadge status={contact.status} />
              </button>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-canvas">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Company</th>
                    <th className="th">Email</th>
                    <th className="th">Phone</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {visible.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-canvas cursor-pointer transition-colors"
                      onClick={() => setViewing(contact)}
                    >
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar
                            initials={initials(contact.first_name, contact.last_name)}
                            seed={contact.id}
                          />
                          <div className="min-w-0">
                            <p className="text-ink truncate font-medium">
                              {fullName(contact.first_name, contact.last_name)}
                            </p>
                            {contact.job_title && (
                              <p className="text-subtle truncate text-xs">{contact.job_title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {contact.company_id ? (companyNames.get(contact.company_id) ?? '—') : '—'}
                      </td>
                      <td className="td">
                        {contact.email ? (
                          <a
                            className="text-brand hover:underline"
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">{contact.phone ?? '—'}</td>
                      <td className="td">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1"
                            onClick={() => setEditing(contact)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-danger px-2 py-1"
                            onClick={() => void onDelete(contact)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {visible.length === 0 && (
            <p className="text-muted py-10 text-center text-sm">No contacts match your filters.</p>
          )}
        </>
      )}

      {viewing && (
        <ContactDetail
          contact={viewing}
          companyName={viewing.company_id ? companyNames.get(viewing.company_id) : undefined}
          deals={(data?.deals ?? []).filter((d) => d.contact_id === viewing.id)}
          tasks={(data?.tasks ?? []).filter((t) => t.contact_id === viewing.id)}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
          }}
          onDelete={() => void onDelete(viewing)}
        />
      )}

      {editing && (
        <ContactForm
          contact={editing === 'new' ? null : editing}
          companies={data?.companies ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            toast('Contact saved.')
          }}
        />
      )}
    </>
  )
}

function FilterChip({
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

/** Right-hand drawer: details, related records and the activity timeline. */
function ContactDetail({
  contact,
  companyName,
  deals,
  tasks,
  onClose,
  onEdit,
  onDelete,
}: {
  contact: Contact
  companyName?: string
  deals: Deal[]
  tasks: Task[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [tab, setTab] = useState<'activity' | 'details'>('activity')
  const openTasks = tasks.filter((t) => !t.completed)

  return (
    <Modal
      open
      variant="side"
      title={fullName(contact.first_name, contact.last_name)}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-danger mr-auto" onClick={onDelete}>
            Delete
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Edit
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Avatar initials={initials(contact.first_name, contact.last_name)} seed={contact.id} />
        <div className="min-w-0">
          <p className="text-ink truncate font-medium">
            {fullName(contact.first_name, contact.last_name)}
          </p>
          <p className="text-subtle truncate text-xs">
            {[contact.job_title, companyName].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <StatusBadge status={contact.status} />
      </div>

      <div className="border-line mb-4 flex gap-1 border-b">
        {(['activity', 'details'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-brand text-brand' : 'text-muted hover:text-ink border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'activity' ? (
        <ActivityFeed contactId={contact.id} />
      ) : (
        <div className="space-y-4">
          <dl className="space-y-2.5 text-sm">
            <DetailRow label="Email">
              {contact.email ? (
                <a className="text-brand hover:underline" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow label="Phone">
              {contact.phone ? (
                <a className="text-brand hover:underline" href={`tel:${contact.phone}`}>
                  {contact.phone}
                </a>
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow label="Company">{companyName ?? '—'}</DetailRow>
            <DetailRow label="Added">{formatDate(contact.created_at)}</DetailRow>
          </dl>

          {contact.notes && (
            <div>
              <p className="label">Notes</p>
              <p className="text-muted text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          <div>
            <p className="label">Deals ({deals.length})</p>
            {deals.length === 0 ? (
              <p className="text-subtle text-sm">No deals linked.</p>
            ) : (
              <ul className="space-y-1.5">
                {deals.map((d) => (
                  <li
                    key={d.id}
                    className="border-line flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-ink truncate">{d.title}</span>
                    <span className="text-muted shrink-0 font-medium">
                      {formatCurrency(Number(d.value), d.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="label">Open tasks ({openTasks.length})</p>
            {openTasks.length === 0 ? (
              <p className="text-subtle text-sm">Nothing outstanding.</p>
            ) : (
              <ul className="space-y-1.5">
                {openTasks.map((t) => (
                  <li
                    key={t.id}
                    className="border-line flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-ink truncate">{t.title}</span>
                    <span className="text-subtle shrink-0 text-xs">{formatDate(t.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-subtle shrink-0">{label}</dt>
      <dd className="text-ink min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}

function ContactForm({
  contact,
  companies,
  onClose,
  onSaved,
}: {
  contact: Contact | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    first_name: contact?.first_name ?? '',
    last_name: contact?.last_name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    job_title: contact?.job_title ?? '',
    company_id: contact?.company_id ?? '',
    status: contact?.status ?? ('lead' as ContactStatus),
    notes: contact?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const values = nullifyBlanks(form)
      if (contact) await updateContact(contact.id, values)
      else await createContact(values)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the contact.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={contact ? 'Edit contact' : 'New contact'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="contact-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save contact'}
          </button>
        </>
      }
    >
      <form id="contact-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className="input"
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              required
            />
          </Field>
          <Field label="Last name">
            <input
              className="input"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              type="tel"
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Job title">
            <input
              className="input"
              value={form.job_title}
              onChange={(e) => set('job_title', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ContactStatus)}
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className="input min-h-24"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
