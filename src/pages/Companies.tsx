import { useMemo, useState, type FormEvent } from 'react'
import {
  createCompany,
  deleteCompany,
  listCompanies,
  listContacts,
  nullifyBlanks,
  updateCompany,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import type { Company, Contact } from '../lib/types'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, Field, PageHeader, Spinner } from '../components/ui'

interface Data {
  companies: Company[]
  contacts: Contact[]
}

export function Companies() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [companies, contacts] = await Promise.all([listCompanies(), listContacts()])
    return { companies, contacts }
  })

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Company | 'new' | null>(null)

  const contactCounts = useMemo(() => {
    const counts = new Map<string, number>()
    data?.contacts.forEach((c) => {
      if (c.company_id) counts.set(c.company_id, (counts.get(c.company_id) ?? 0) + 1)
    })
    return counts
  }, [data])

  const visible = useMemo(() => {
    const companies = data?.companies ?? []
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) =>
      [c.name, c.domain, c.industry, c.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    )
  }, [data, search])

  async function onDelete(company: Company) {
    if (
      !confirm(
        `Delete ${company.name}? Contacts and deals stay, but lose their link to this company.`,
      )
    )
      return
    await deleteCompany(company.id)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={`${data?.companies.length ?? 0} organisations`}
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New company
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {loading ? (
        <Spinner />
      ) : data && data.companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Group your contacts and deals under the organisations they belong to."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New company
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-3">
            <input
              className="input max-w-xs"
              placeholder="Search companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Company</th>
                  <th className="th">Industry</th>
                  <th className="th">Phone</th>
                  <th className="th">Contacts</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="td">
                      <p className="font-medium text-slate-900">{company.name}</p>
                      {company.domain && (
                        <a
                          className="text-xs text-indigo-600 hover:underline"
                          href={`https://${company.domain}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {company.domain}
                        </a>
                      )}
                    </td>
                    <td className="td">{company.industry ?? '—'}</td>
                    <td className="td">{company.phone ?? '—'}</td>
                    <td className="td">{contactCounts.get(company.id) ?? 0}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1"
                          onClick={() => setEditing(company)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => void onDelete(company)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td className="td text-center text-slate-500" colSpan={5}>
                      No companies match “{search}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <CompanyForm
          company={editing === 'new' ? null : editing}
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

function CompanyForm({
  company,
  onClose,
  onSaved,
}: {
  company: Company | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: company?.name ?? '',
    domain: company?.domain ?? '',
    industry: company?.industry ?? '',
    phone: company?.phone ?? '',
    address: company?.address ?? '',
    notes: company?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const values = nullifyBlanks(form)
      if (company) await updateCompany(company.id, values)
      else await createCompany(values)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the company.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={company ? 'Edit company' : 'New company'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="company-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save company'}
          </button>
        </>
      }
    >
      <form id="company-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Field label="Name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Domain" hint="Without https://">
            <input
              className="input"
              value={form.domain}
              onChange={(e) => set('domain', e.target.value)}
              placeholder="acme.com"
            />
          </Field>
          <Field label="Industry">
            <input
              className="input"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Phone">
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>

        <Field label="Address">
          <input
            className="input"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </Field>

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
