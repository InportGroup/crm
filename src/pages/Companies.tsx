import { useMemo, useState, type FormEvent } from 'react'
import {
  createCompany,
  deleteCompany,
  listCompanies,
  listContacts,
  listDeals,
  nullifyBlanks,
  updateCompany,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { formatCurrency } from '../lib/format'
import { OPEN_STAGES, type Company, type Contact, type Deal } from '../lib/types'
import { Modal } from '../components/Modal'
import { Avatar, EmptyState, ErrorNote, Field, PageHeader, SkeletonList } from '../components/ui'

interface Data {
  companies: Company[]
  contacts: Contact[]
  deals: Deal[]
}

export function Companies() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [companies, contacts, deals] = await Promise.all([
      listCompanies(),
      listContacts(),
      listDeals(),
    ])
    return { companies, contacts, deals }
  })

  const { toast, confirm } = useFeedback()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Company | 'new' | null>(null)

  const stats = useMemo(() => {
    const map = new Map<string, { contacts: number; pipeline: number }>()
    data?.companies.forEach((c) => map.set(c.id, { contacts: 0, pipeline: 0 }))
    data?.contacts.forEach((c) => {
      if (c.company_id && map.has(c.company_id)) map.get(c.company_id)!.contacts += 1
    })
    data?.deals.forEach((d) => {
      if (d.company_id && map.has(d.company_id) && OPEN_STAGES.includes(d.stage)) {
        map.get(d.company_id)!.pipeline += Number(d.value)
      }
    })
    return map
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
    const ok = await confirm({
      title: `Delete ${company.name}?`,
      message: 'Contacts and deals stay, but lose their link to this company.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteCompany(company.id)
      reload()
      toast('Company deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete.', 'error')
    }
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
        <SkeletonList />
      ) : data && data.companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Group contacts and deals under the organisations they belong to."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New company
            </button>
          }
        />
      ) : (
        <>
          <input
            className="input mb-4 sm:max-w-xs"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {visible.map((company) => {
              const s = stats.get(company.id)
              return (
                <div key={company.id} className="rowcard">
                  <div className="flex items-start gap-3">
                    <Avatar initials={company.name.slice(0, 2).toUpperCase()} seed={company.id} />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-sm font-medium">{company.name}</p>
                      <p className="text-subtle truncate text-xs">{company.industry ?? '—'}</p>
                    </div>
                  </div>
                  <div className="text-muted mt-3 flex items-center gap-4 text-xs">
                    <span>{s?.contacts ?? 0} contacts</span>
                    <span>{formatCurrency(s?.pipeline ?? 0)} open</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary flex-1 py-1.5"
                      onClick={() => setEditing(company)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger py-1.5"
                      onClick={() => void onDelete(company)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-canvas">
                  <tr>
                    <th className="th">Company</th>
                    <th className="th">Industry</th>
                    <th className="th">Phone</th>
                    <th className="th">Contacts</th>
                    <th className="th">Open pipeline</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {visible.map((company) => {
                    const s = stats.get(company.id)
                    return (
                      <tr key={company.id} className="hover:bg-canvas transition-colors">
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar
                              initials={company.name.slice(0, 2).toUpperCase()}
                              seed={company.id}
                            />
                            <div className="min-w-0">
                              <p className="text-ink truncate font-medium">{company.name}</p>
                              {company.domain && (
                                <a
                                  className="text-brand text-xs hover:underline"
                                  href={`https://${company.domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {company.domain}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="td">{company.industry ?? '—'}</td>
                        <td className="td">{company.phone ?? '—'}</td>
                        <td className="td">{s?.contacts ?? 0}</td>
                        <td className="td font-medium">{formatCurrency(s?.pipeline ?? 0)}</td>
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
                              className="btn-ghost text-danger px-2 py-1"
                              onClick={() => void onDelete(company)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {visible.length === 0 && (
            <p className="text-muted py-10 text-center text-sm">No companies match “{search}”.</p>
          )}
        </>
      )}

      {editing && (
        <CompanyForm
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            toast('Company saved.')
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
          <input
            type="tel"
            className="input"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
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
