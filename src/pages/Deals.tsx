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
import { useFeedback } from '../context/feedback'
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
import { ActivityFeed } from '../components/ActivityFeed'
import { EmptyState, ErrorNote, Field, PageHeader, Spinner, StageBadge } from '../components/ui'

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

  const { toast, confirm } = useFeedback()
  const [editing, setEditing] = useState<Deal | 'new' | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null)

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

  const summary = useMemo(() => {
    const deals = data?.deals ?? []
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const won = deals.filter((d) => d.stage === 'won')
    const decided = deals.filter((d) => d.stage === 'won' || d.stage === 'lost')
    return {
      pipeline: open.reduce((sum, d) => sum + Number(d.value), 0),
      weighted: open.reduce((sum, d) => sum + (Number(d.value) * d.probability) / 100, 0),
      winRate: decided.length ? Math.round((won.length / decided.length) * 100) : null,
    }
  }, [data])

  async function moveTo(id: string, stage: DealStage) {
    const deal = data?.deals.find((d) => d.id === id)
    if (!deal || deal.stage === stage) return
    try {
      await updateDeal(id, { stage })
      reload()
      toast(`Moved to ${stage}.`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not move the deal.', 'error')
    }
  }

  function onDrop(e: DragEvent, stage: DealStage) {
    e.preventDefault()
    const id = dragging
    setDragging(null)
    setDropTarget(null)
    if (id) void moveTo(id, stage)
  }

  async function onDelete(deal: Deal) {
    const ok = await confirm({
      title: `Delete “${deal.title}”?`,
      message: 'Its activity and tasks go too. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await deleteDeal(deal.id)
    setEditing(null)
    reload()
    toast('Deal deleted.')
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New deal
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {!loading && data && data.deals.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat label="Open pipeline" value={formatCurrency(summary.pipeline)} />
          <MiniStat
            label="Weighted"
            value={formatCurrency(summary.weighted)}
            hint="by probability"
          />
          <MiniStat
            label="Win rate"
            value={summary.winRate === null ? '—' : `${summary.winRate}%`}
            hint="won vs decided"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : data && data.deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Track the opportunities you are working on through the pipeline."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New deal
            </button>
          }
        />
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
          {DEAL_STAGES.map((stage) => {
            const deals = byStage.get(stage.id) ?? []
            const total = deals.reduce((sum, d) => sum + Number(d.value), 0)

            return (
              <section
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(stage.id)
                }}
                onDragLeave={() => setDropTarget((s) => (s === stage.id ? null : s))}
                onDrop={(e) => onDrop(e, stage.id)}
                className={`flex w-[78vw] shrink-0 snap-start flex-col rounded-xl border p-3 transition-colors sm:w-64 ${
                  dropTarget === stage.id
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-canvas'
                }`}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-ink text-sm font-semibold">
                    {stage.label}
                    <span className="text-subtle ml-1.5 text-xs font-normal">{deals.length}</span>
                  </h2>
                  <span className="text-muted text-xs font-medium">{formatCurrency(total)}</span>
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
                      className={`border-line bg-surface hover:border-brand/50 cursor-pointer rounded-lg border p-3 shadow-sm transition-all ${
                        dragging === deal.id ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-ink text-sm font-medium">{deal.title}</p>
                      {deal.company_id && (
                        <p className="text-subtle mt-0.5 text-xs">
                          {companyNames.get(deal.company_id)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-ink text-sm font-semibold">
                          {formatCurrency(Number(deal.value), deal.currency)}
                        </span>
                        <span className="text-subtle text-xs">{deal.probability}%</span>
                      </div>

                      {/* Probability bar — quick visual read of deal health. */}
                      <div className="bg-neutral-soft mt-2 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-brand h-full rounded-full"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>

                      {deal.expected_close_date && (
                        <p className="text-subtle mt-1.5 text-xs">
                          Closes {formatDate(deal.expected_close_date)}
                        </p>
                      )}

                      {/* Touch fallback: drag-and-drop does not fire on mobile. */}
                      <select
                        value={deal.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation()
                          void moveTo(deal.id, e.target.value as DealStage)
                        }}
                        aria-label={`Move ${deal.title} to another stage`}
                        className="border-line bg-canvas text-muted mt-2.5 w-full rounded-md border px-2 py-1 text-xs sm:hidden"
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            Move to {s.label}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}

                  {deals.length === 0 && (
                    <p className="border-line text-subtle rounded-lg border border-dashed py-6 text-center text-xs">
                      Nothing here
                    </p>
                  )}
                </div>
              </section>
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
            toast('Deal saved.')
          }}
          onDelete={onDelete}
        />
      )}
    </>
  )
}

function MiniStat({
  label,
  value,
  hint,
  className = '',
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className={`card px-4 py-3 ${className}`}>
      <p className="text-subtle text-xs">{label}</p>
      <p className="text-ink mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-subtle text-[11px]">{hint}</p>}
    </div>
  )
}

function DealForm({
  deal,
  companies,
  contacts,
  onClose,
  onSaved,
  onDelete,
}: {
  deal: Deal | null
  companies: Company[]
  contacts: Contact[]
  onClose: () => void
  onSaved: () => void
  onDelete: (deal: Deal) => void
}) {
  const [tab, setTab] = useState<'details' | 'activity'>('details')
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
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={deal ? deal.title : 'New deal'}
      onClose={onClose}
      footer={
        tab === 'details' ? (
          <>
            {deal && (
              <button
                type="button"
                className="btn-danger mr-auto"
                onClick={() => onDelete(deal)}
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
        ) : (
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {deal && (
        <div className="border-line mb-4 flex gap-1 border-b">
          {(['details', 'activity'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-brand text-brand'
                  : 'text-muted hover:text-ink border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {deal && tab === 'activity' ? (
        <ActivityFeed dealId={deal.id} />
      ) : (
        <form id="deal-form" onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorNote message={error} />}

          {deal && (
            <div className="flex items-center gap-2">
              <StageBadge stage={deal.stage} />
              <span className="text-subtle text-xs">Created {formatDate(deal.created_at)}</span>
            </div>
          )}

          <Field label="Title">
            <input
              className="input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Value">
              <input
                type="number"
                inputMode="decimal"
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
                inputMode="numeric"
                min="0"
                max="100"
                className="input"
                value={form.probability}
                onChange={(e) => set('probability', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      )}
    </Modal>
  )
}
