import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import {
  createDeal,
  deleteDeal,
  listCompanies,
  listContacts,
  listDeals,
  nullifyBlanks,
  updateDeal,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCurrency, formatDate, fullName } from '../lib/format'
import {
  DEAL_STAGES,
  OPEN_STAGES,
  type Company,
  type Contact,
  type Deal,
  type DealStage,
} from '../lib/types'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, Field, PageHeader, Spinner } from '../components/ui'

interface Data {
  deals: Deal[]
  companies: Company[]
  contacts: Contact[]
}

export function Deals() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [deals, companies, contacts] = await Promise.all([
      listDeals(),
      listCompanies(),
      listContacts(),
    ])
    return { deals, companies, contacts }
  })

  const [editing, setEditing] = useState<Deal | 'new' | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null)
  const [moveError, setMoveError] = useState('')

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const byStage = useMemo(() => {
    const groups = new Map<DealStage, Deal[]>(DEAL_STAGES.map((s) => [s.id, []]))
    data?.deals.forEach((deal) => groups.get(deal.stage)?.push(deal))
    return groups
  }, [data])

  const openValue = useMemo(
    () =>
      (data?.deals ?? [])
        .filter((d) => OPEN_STAGES.includes(d.stage))
        .reduce((sum, d) => sum + Number(d.value), 0),
    [data],
  )

  async function moveTo(stage: DealStage) {
    const id = dragging
    setDragging(null)
    setDropTarget(null)
    if (!id) return

    const deal = data?.deals.find((d) => d.id === id)
    if (!deal || deal.stage === stage) return

    setMoveError('')
    try {
      await updateDeal(id, { stage })
      reload()
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move the deal.')
    }
  }

  function onDrop(e: DragEvent, stage: DealStage) {
    e.preventDefault()
    void moveTo(stage)
  }

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={`${formatCurrency(openValue)} in open pipeline`}
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New deal
          </button>
        }
      />

      {error && <ErrorNote message={error} />}
      {moveError && <ErrorNote message={moveError} />}

      {loading ? (
        <Spinner />
      ) : data && data.deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Track the opportunities you are working on through your pipeline."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New deal
            </button>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => {
            const deals = byStage.get(stage.id) ?? []
            const total = deals.reduce((sum, d) => sum + Number(d.value), 0)

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(stage.id)
                }}
                onDragLeave={() => setDropTarget((s) => (s === stage.id ? null : s))}
                onDrop={(e) => onDrop(e, stage.id)}
                className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors ${
                  dropTarget === stage.id
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">
                    {stage.label}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">{deals.length}</span>
                  </h2>
                  <span className="text-xs font-medium text-slate-500">{formatCurrency(total)}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {deals.map((deal) => (
                    <article
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragging(deal.id)}
                      onDragEnd={() => {
                        setDragging(null)
                        setDropTarget(null)
                      }}
                      onClick={() => setEditing(deal)}
                      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow ${
                        dragging === deal.id ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">{deal.title}</p>
                      {deal.company_id && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {companyNames.get(deal.company_id)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">
                          {formatCurrency(Number(deal.value), deal.currency)}
                        </span>
                        <span className="text-xs text-slate-400">{deal.probability}%</span>
                      </div>
                      {deal.expected_close_date && (
                        <p className="mt-1 text-xs text-slate-400">
                          Closes {formatDate(deal.expected_close_date)}
                        </p>
                      )}
                    </article>
                  ))}

                  {deals.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                      Drop a deal here
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <DealForm
          deal={editing === 'new' ? null : editing}
          companies={data?.companies ?? []}
          contacts={data?.contacts ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
          onDeleted={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function DealForm({
  deal,
  companies,
  contacts,
  onClose,
  onSaved,
  onDeleted,
}: {
  deal: Deal | null
  companies: Company[]
  contacts: Contact[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState({
    title: deal?.title ?? '',
    value: String(deal?.value ?? ''),
    currency: deal?.currency ?? 'EUR',
    stage: deal?.stage ?? ('new' as DealStage),
    probability: String(deal?.probability ?? 10),
    expected_close_date: deal?.expected_close_date ?? '',
    company_id: deal?.company_id ?? '',
    contact_id: deal?.contact_id ?? '',
    notes: deal?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const values = nullifyBlanks({
        ...form,
        value: Number(form.value || 0),
        probability: Number(form.probability || 0),
      })
      if (deal) await updateDeal(deal.id, values)
      else await createDeal(values)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the deal.')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!deal || !confirm(`Delete “${deal.title}”?`)) return
    setBusy(true)
    try {
      await deleteDeal(deal.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the deal.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={deal ? 'Edit deal' : 'New deal'}
      onClose={onClose}
      footer={
        <>
          {deal && (
            <button
              type="button"
              className="btn-danger mr-auto"
              onClick={() => void onDelete()}
              disabled={busy}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="deal-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save deal'}
          </button>
        </>
      }
    >
      <form id="deal-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Field label="Title">
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Value">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <select
              className="input"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {['EUR', 'USD', 'GBP'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Probability %">
            <input
              type="number"
              min="0"
              max="100"
              className="input"
              value={form.probability}
              onChange={(e) => set('probability', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <select
              className="input"
              value={form.stage}
              onChange={(e) => set('stage', e.target.value)}
            >
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected close">
            <input
              type="date"
              className="input"
              value={form.expected_close_date}
              onChange={(e) => set('expected_close_date', e.target.value)}
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
          <Field label="Contact">
            <select
              className="input"
              value={form.contact_id}
              onChange={(e) => set('contact_id', e.target.value)}
            >
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c.first_name, c.last_name)}
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
