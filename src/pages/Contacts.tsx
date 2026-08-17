import { useMemo, useState, type FormEvent } from 'react'
import {
  createContact,
  deleteContact,
  listCompanies,
  listContacts,
  nullifyBlanks,
  updateContact,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { fullName, initials } from '../lib/format'
import { CONTACT_STATUSES, type Company, type Contact, type ContactStatus } from '../lib/types'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, Field, PageHeader, Spinner, StatusBadge } from '../components/ui'

interface Data {
  contacts: Contact[]
  companies: Company[]
}

export function Contacts() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [contacts, companies] = await Promise.all([listContacts(), listCompanies()])
    return { contacts, companies }
  })

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const visible = useMemo(() => {
    const contacts = data?.contacts ?? []
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      [
        fullName(c.first_name, c.last_name),
        c.email,
        c.phone,
        c.job_title,
        c.company_id ? companyNames.get(c.company_id) : '',
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    )
  }, [data, search, companyNames])

  async function onDelete(contact: Contact) {
    if (!confirm(`Delete ${fullName(contact.first_name, contact.last_name)}?`)) return
    await deleteContact(contact.id)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${data?.contacts.length ?? 0} people in your CRM`}
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New contact
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {loading ? (
        <Spinner />
      ) : data && data.contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the first person you are talking to."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New contact
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-3">
            <input
              className="input max-w-xs"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Company</th>
                  <th className="th">Email</th>
                  <th className="th">Phone</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {initials(contact.first_name, contact.last_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {fullName(contact.first_name, contact.last_name)}
                          </p>
                          {contact.job_title && (
                            <p className="truncate text-xs text-slate-500">{contact.job_title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {contact.company_id ? (companyNames.get(contact.company_id) ?? '—') : '—'}
                    </td>
                    <td className="td">
                      {contact.email ? (
                        <a className="text-indigo-600 hover:underline" href={`mailto:${contact.email}`}>
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
                    <td className="td">
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
                          className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => void onDelete(contact)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td className="td text-center text-slate-500" colSpan={6}>
                      No contacts match “{search}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <ContactForm
          contact={editing === 'new' ? null : editing}
          companies={data?.companies ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
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
    } finally {
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
