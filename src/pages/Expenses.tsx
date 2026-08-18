import { useMemo, useState, type FormEvent } from 'react'
import {
  confirmReimbursement,
  createExpenseReturning,
  deleteExpense,
  getInvoiceUrl,
  listCompanies,
  listDeals,
  listExpenses,
  listProfiles,
  nullifyBlanks,
  removeInvoice,
  undoReimbursement,
  updateExpense,
  uploadInvoice,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { useAuth } from '../context/auth'
import { formatCurrency, formatDate, formatMoney, taxBreakdown, todayISO } from '../lib/format'
import {
  CATEGORY_LABELS,
  COST_TYPES,
  DEFAULT_TAX_RATE,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  REIMBURSABLE_METHODS,
  TAX_RATES,
  type Company,
  type CostType,
  type Deal,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type PaymentMethod,
  type Profile,
} from '../lib/types'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, Field, PageHeader, SkeletonList } from '../components/ui'

interface Data {
  expenses: Expense[]
  companies: Company[]
  deals: Deal[]
  profiles: Profile[]
}

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: 'bg-warn-soft text-warn-ink',
  approved: 'bg-info-soft text-info-ink',
  reimbursed: 'bg-ok-soft text-ok-ink',
  rejected: 'bg-danger-soft text-danger-ink',
}

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  travel: 'M10 2 3 9h3v7h3v-4h2v4h3V9h3L10 2Z',
  meals: 'M5 3v6a3 3 0 0 0 2 2.8V17h2v-5.2A3 3 0 0 0 11 9V3H9v5H8V3H7v5H6V3H5Zm8 0v14h2v-5h1a2 2 0 0 0 2-2V3h-5Z',
  software: 'M3 4h14v9H3V4Zm1.5 11h11l1.5 2H3l1.5-2Z',
  cloud: 'M6 16a4 4 0 0 1-.5-7.97 5 5 0 0 1 9.66-1.02A3.5 3.5 0 0 1 14.5 16H6Z',
  licenses: 'M4 3h9l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 5h7v1.5H6V8Zm0 3h7v1.5H6V11Zm0 3h4.5v1.5H6V14Z',
  hardware: 'M6 4h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1 3v6h6V7H7Z',
  office: 'M4 3h8a1 1 0 0 1 1 1v13H3V4a1 1 0 0 1 1-1Zm10 6h2a1 1 0 0 1 1 1v7h-3V9Z',
  marketing: 'M4 8v4h2l4 3V5L6 8H4Zm10.5 2a3.5 3.5 0 0 1-1.5 2.9V7.1A3.5 3.5 0 0 1 14.5 10Z',
  training: 'M10 3 2 7l8 4 8-4-8-4Zm-6 7v3.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V10l-6 3-6-3Z',
  utilities: 'M11 2 5 11h4l-1 7 6-9h-4l1-7Z',
  professional: 'M8 3h4v2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3Zm1 2h2V4H9v1Z',
  other: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-4H9v-2h2v2Zm0-3H9V6h2v5Z',
}

export function Expenses() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [expenses, companies, deals, profiles] = await Promise.all([
      listExpenses(),
      listCompanies(),
      listDeals(),
      listProfiles(),
    ])
    return { expenses, companies, deals, profiles }
  })

  const { toast, confirm } = useFeedback()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all')
  const [costFilter, setCostFilter] = useState<CostType | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all')
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const dealNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.deals.forEach((d) => map.set(d.id, d.title))
    return map
  }, [data])

  const payerNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.profiles.forEach((p) => map.set(p.id, p.full_name ?? 'Unnamed'))
    return map
  }, [data])

  const visible = useMemo(() => {
    const expenses = data?.expenses ?? []
    const q = search.trim().toLowerCase()
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (costFilter !== 'all' && e.cost_type !== costFilter) return false
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (!q) return true
      return [e.description, e.vendor, e.category, e.invoice_number, e.notes]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    })
  }, [data, search, statusFilter, costFilter, categoryFilter])

  const totals = useMemo(() => {
    const expenses = data?.expenses ?? []
    const month = todayISO().slice(0, 7)
    const sum = (list: Expense[]) => list.reduce((t, e) => t + Number(e.amount), 0)
    const monthly = expenses.filter((e) => e.spent_on.startsWith(month))
    return {
      thisMonth: sum(monthly),
      direct: sum(monthly.filter((e) => e.cost_type === 'direct')),
      structural: sum(monthly.filter((e) => e.cost_type === 'structural')),
      // Deductible VAT for the month, the figure the quarterly return needs.
      taxThisMonth: monthly.reduce((t, e) => t + Number(e.tax_amount ?? 0), 0),
      pending: sum(expenses.filter((e) => e.status === 'pending')),
      awaitingReimbursement: sum(
        expenses.filter(
          (e) => e.reimbursable && e.status !== 'reimbursed' && e.status !== 'rejected',
        ),
      ),
      all: sum(expenses),
    }
  }, [data])

  /** Category breakdown for the current filter, biggest first. */
  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>()
    visible.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [visible])

  const maxCategory = Math.max(1, ...byCategory.map(([, v]) => v))

  /** Who is owed what: unreimbursed spend grouped by payer. */
  const byPayer = useMemo(() => {
    const map = new Map<string, number>()
    ;(data?.expenses ?? [])
      .filter(
        (e) =>
          e.paid_by && e.reimbursable && e.status !== 'reimbursed' && e.status !== 'rejected',
      )
      .forEach((e) => map.set(e.paid_by!, (map.get(e.paid_by!) ?? 0) + Number(e.amount)))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  async function setStatus(expense: Expense, status: ExpenseStatus) {
    try {
      await updateExpense(expense.id, { status })
      reload()
      toast(`Marked ${status}.`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update.', 'error')
    }
  }

  /** Settles what the company owes back, recording when and who confirmed it. */
  async function onConfirmReimbursement(expense: Expense) {
    const ok = await confirm({
      title: 'Confirm reimbursement?',
      message: `${formatCurrency(Number(expense.amount), expense.currency)} paid back to ${
        expense.paid_by ? (payerNames.get(expense.paid_by) ?? 'the payer') : 'the payer'
      }. This records today as the reimbursement date.`,
      confirmLabel: 'Confirm',
    })
    if (!ok) return
    try {
      await confirmReimbursement(expense.id, user?.id ?? null, todayISO())
      reload()
      toast('Reimbursement confirmed.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not confirm.', 'error')
    }
  }

  async function onUndoReimbursement(expense: Expense) {
    try {
      await undoReimbursement(expense.id)
      reload()
      toast('Reimbursement reopened.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reopen.', 'error')
    }
  }

  async function onDelete(expense: Expense) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: expense.invoice_path
        ? `“${expense.description}” and its attached invoice will be removed for everyone.`
        : `“${expense.description}” will be removed for everyone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      // Remove the document first; a failure here would otherwise orphan the
      // file in storage with no row left pointing at it.
      if (expense.invoice_path) await removeInvoice(expense.invoice_path)
      await deleteExpense(expense.id)
      reload()
      toast('Expense deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Internal company spend"
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New expense
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      {!loading && (data?.expenses.length ?? 0) > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Total
            label="This month"
            value={formatCurrency(totals.thisMonth)}
            hint={`incl. ${formatCurrency(totals.taxThisMonth)} VAT`}
          />
          <Total
            label="Direct costs"
            value={formatCurrency(totals.direct)}
            hint="this month, on projects"
          />
          <Total
            label="Structural costs"
            value={formatCurrency(totals.structural)}
            hint="this month, overhead"
          />
          <Total label="Pending approval" value={formatCurrency(totals.pending)} tone="warn" />
          <Total
            label="To reimburse"
            value={formatCurrency(totals.awaitingReimbursement)}
            tone="info"
            className="col-span-2 xl:col-span-1"
          />
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : data && data.expenses.length === 0 ? (
        <EmptyState
          title="No expenses logged"
          description="Record internal spend — hardware, cloud, licences, travel — split it into direct and structural costs, and track it through approval."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New expense
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input sm:max-w-xs"
              placeholder="Search expenses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                All
              </Chip>
              {EXPENSE_STATUSES.map((s) => (
                <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Chip active={costFilter === 'all'} onClick={() => setCostFilter('all')}>
                All costs
              </Chip>
              {COST_TYPES.map((t) => (
                <Chip key={t.id} active={costFilter === t.id} onClick={() => setCostFilter(t.id)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <select
              className="input sm:ml-auto sm:max-w-52"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          {(byCategory.length > 1 || byPayer.length > 0) && (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              {byCategory.length > 1 && (
                <section className="card p-5">
                  <h2 className="text-ink text-sm font-semibold">By category</h2>
                  <ul className="mt-3 space-y-2.5">
                    {byCategory.map(([cat, value]) => (
                      <li key={cat}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted">{CATEGORY_LABELS[cat] ?? cat}</span>
                          <span className="text-ink font-medium">{formatCurrency(value)}</span>
                        </div>
                        <div className="bg-neutral-soft mt-1.5 h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-brand h-full rounded-full transition-all duration-500"
                            style={{ width: `${(value / maxCategory) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {byPayer.length > 0 && (
                <section className="card p-5">
                  <h2 className="text-ink text-sm font-semibold">Owed to</h2>
                  <p className="text-subtle mt-0.5 text-xs">
                    Spend not yet reimbursed, by whoever paid
                  </p>
                  <ul className="divide-line mt-3 divide-y">
                    {byPayer.map(([id, value]) => (
                      <li key={id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted">{payerNames.get(id) ?? 'Unknown'}</span>
                        <span className="text-ink font-medium">{formatCurrency(value)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {visible.map((expense) => (
              <div key={expense.id} className="rowcard">
                <div className="flex items-start gap-3">
                  <span className="bg-brand-soft text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d={CATEGORY_ICONS[expense.category]} />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm font-medium">{expense.description}</p>
                    <p className="text-subtle truncate text-xs">
                      {CATEGORY_LABELS[expense.category] ?? expense.category} ·{' '}
                      {formatDate(expense.spent_on)}
                      {expense.vendor ? ` · ${expense.vendor}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CostTypeBadge type={expense.cost_type} />
                      {expense.deal_id && (
                        <span className="text-muted text-xs">
                          {dealNames.get(expense.deal_id) ?? ''}
                        </span>
                      )}
                      {expense.paid_by && (
                        <span className="text-muted text-xs">
                          Paid by {payerNames.get(expense.paid_by) ?? '—'}
                        </span>
                      )}
                      {expense.invoice_number && (
                        <span className="text-subtle text-xs">#{expense.invoice_number}</span>
                      )}
                      <InvoiceLink expense={expense} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-ink text-sm font-semibold">
                      {formatCurrency(Number(expense.amount), expense.currency)}
                    </p>
                    <p className="text-subtle text-xs">
                      +{formatCurrency(Number(expense.tax_amount ?? 0), expense.currency)} VAT
                    </p>
                    <span className={`badge mt-1 ${STATUS_STYLES[expense.status]}`}>
                      {expense.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {expense.reimbursable && expense.status !== 'reimbursed' && (
                    <button
                      type="button"
                      className="btn-primary flex-1 py-1.5"
                      onClick={() => void onConfirmReimbursement(expense)}
                    >
                      Reimburse
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary flex-1 py-1.5"
                    onClick={() => setEditing(expense)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger py-1.5"
                    onClick={() => void onDelete(expense)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-canvas">
                  <tr>
                    <th className="th">Description</th>
                    <th className="th">Type</th>
                    <th className="th">Paid by</th>
                    <th className="th">Date</th>
                    <th className="th">Invoice</th>
                    <th className="th text-right">Base</th>
                    <th className="th text-right">VAT</th>
                    <th className="th text-right">Total</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {visible.map((expense) => (
                    <tr key={expense.id} className="hover:bg-canvas transition-colors">
                      <td className="td">
                        <p className="text-ink font-medium">{expense.description}</p>
                        <p className="text-subtle text-xs">
                          {[
                            CATEGORY_LABELS[expense.category] ?? expense.category,
                            expense.vendor,
                            expense.deal_id && dealNames.get(expense.deal_id),
                            expense.company_id && companyNames.get(expense.company_id),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </td>
                      <td className="td">
                        <CostTypeBadge type={expense.cost_type} />
                      </td>
                      <td className="td">
                        {expense.paid_by ? (payerNames.get(expense.paid_by) ?? '—') : '—'}
                        <p className="text-subtle text-xs">
                          {PAYMENT_METHOD_LABELS[expense.payment_method] ??
                            expense.payment_method}
                        </p>
                      </td>
                      <td className="td">{formatDate(expense.spent_on)}</td>
                      <td className="td">
                        <InvoiceLink expense={expense} />
                        {expense.invoice_number && (
                          <p className="text-subtle text-xs">#{expense.invoice_number}</p>
                        )}
                      </td>
                      <td className="td text-muted text-right">
                        {formatCurrency(Number(expense.net_amount ?? 0), expense.currency)}
                      </td>
                      <td className="td text-muted text-right">
                        {formatCurrency(Number(expense.tax_amount ?? 0), expense.currency)}
                        <span className="text-subtle block text-xs">{expense.tax_rate ?? 0}%</span>
                      </td>
                      <td className="td text-ink text-right font-medium">
                        {formatCurrency(Number(expense.amount), expense.currency)}
                      </td>
                      <td className="td">
                        {/* Inline status change — the common action on this page. */}
                        <select
                          value={expense.status}
                          onChange={(e) => void setStatus(expense, e.target.value as ExpenseStatus)}
                          aria-label={`Status of ${expense.description}`}
                          className={`badge cursor-pointer border-0 capitalize ${STATUS_STYLES[expense.status]}`}
                        >
                          {EXPENSE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {expense.status === 'reimbursed' && expense.reimbursed_on && (
                          <p className="text-subtle mt-1 text-xs">
                            {formatDate(expense.reimbursed_on)}
                            {expense.reimbursed_by
                              ? ` · ${payerNames.get(expense.reimbursed_by) ?? ''}`
                              : ''}
                          </p>
                        )}
                        {expense.reimbursable && expense.status !== 'reimbursed' && (
                          <p className="text-warn-ink mt-1 text-xs">Owed back</p>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {expense.reimbursable && expense.status !== 'reimbursed' && (
                            <button
                              type="button"
                              className="btn-ghost text-brand px-2 py-1"
                              onClick={() => void onConfirmReimbursement(expense)}
                            >
                              Reimburse
                            </button>
                          )}
                          {expense.status === 'reimbursed' && (
                            <button
                              type="button"
                              className="btn-ghost px-2 py-1"
                              onClick={() => void onUndoReimbursement(expense)}
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1"
                            onClick={() => setEditing(expense)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-danger px-2 py-1"
                            onClick={() => void onDelete(expense)}
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
            <p className="text-muted py-10 text-center text-sm">No expenses match your filters.</p>
          )}
        </>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          companies={data?.companies ?? []}
          deals={data?.deals ?? []}
          profiles={data?.profiles ?? []}
          currentUserId={user?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            reload()
            toast(message)
          }}
        />
      )}
    </>
  )
}

/**
 * Opens an invoice in a new tab. The bucket is private, so the URL has to be
 * signed at click time rather than rendered into the page as a static href.
 */
function InvoiceLink({ expense }: { expense: Expense }) {
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)

  if (!expense.invoice_path) return <span className="text-subtle text-xs">—</span>

  async function open() {
    setBusy(true)
    try {
      const url = await getInvoiceUrl(expense.invoice_path!)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the invoice.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className="text-brand inline-flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
      title={expense.invoice_name ?? 'View invoice'}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
        <path d="M4 3h7l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V7h2.5L11 4.5ZM6 9h8v1.5H6V9Zm0 3h8v1.5H6V12Z" />
      </svg>
      {busy ? 'Opening…' : 'View'}
    </button>
  )
}

function CostTypeBadge({ type }: { type: CostType }) {
  return (
    <span
      className={`badge ${
        type === 'direct' ? 'bg-brand-soft text-brand-ink' : 'bg-info-soft text-info-ink'
      }`}
    >
      {type === 'direct' ? 'Direct' : 'Structural'}
    </span>
  )
}

function Total({
  label,
  value,
  tone,
  hint,
  className = '',
}: {
  label: string
  value: string
  tone?: 'warn' | 'info'
  hint?: string
  className?: string
}) {
  return (
    <div className={`card px-4 py-3 ${className}`}>
      <p className="text-subtle text-xs">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold tracking-tight ${
          tone === 'warn' ? 'text-warn-ink' : tone === 'info' ? 'text-info-ink' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-subtle mt-0.5 text-xs">{hint}</p>}
    </div>
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

const MAX_INVOICE_BYTES = 10 * 1024 * 1024
const ACCEPTED_INVOICE = 'application/pdf,image/jpeg,image/png,image/heic,image/webp'

function ExpenseForm({
  expense,
  companies,
  deals,
  profiles,
  currentUserId,
  onClose,
  onSaved,
}: {
  expense: Expense | null
  companies: Company[]
  deals: Deal[]
  profiles: Profile[]
  currentUserId: string | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    // The user types the taxable base; the gross total is derived from it.
    net_amount: expense ? String(expense.net_amount ?? '') : '',
    tax_rate: String(expense?.tax_rate ?? DEFAULT_TAX_RATE),
    currency: expense?.currency ?? 'EUR',
    cost_type: expense?.cost_type ?? ('structural' as CostType),
    category: expense?.category ?? ('other' as ExpenseCategory),
    spent_on: expense?.spent_on ?? todayISO(),
    vendor: expense?.vendor ?? '',
    payment_method: expense?.payment_method ?? ('company_card' as PaymentMethod),
    status: expense?.status ?? ('pending' as ExpenseStatus),
    invoice_number: expense?.invoice_number ?? '',
    // Default to whoever is filling the form in — the common case.
    paid_by: expense?.paid_by ?? currentUserId ?? '',
    company_id: expense?.company_id ?? '',
    deal_id: expense?.deal_id ?? '',
    notes: expense?.notes ?? '',
  })
  // Tracked separately: it follows the payment method until the user overrides
  // it. New expenses default to the company card, which is never owed back.
  const [reimbursable, setReimbursable] = useState(expense?.reimbursable ?? false)
  const [file, setFile] = useState<File | null>(null)
  const [removeExisting, setRemoveExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  /**
   * Picking a personal payment method implies the money is owed back. It stays
   * a suggestion — the checkbox below can still be unticked.
   */
  function setPaymentMethod(method: string) {
    set('payment_method', method)
    setReimbursable(REIMBURSABLE_METHODS.includes(method as PaymentMethod))
  }

  const totals = useMemo(
    () => taxBreakdown(Number(form.net_amount || 0), Number(form.tax_rate || 0)),
    [form.net_amount, form.tax_rate],
  )

  function onPickFile(picked: File | null) {
    setError('')
    if (picked && picked.size > MAX_INVOICE_BYTES) {
      setError(`That file is ${(picked.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`)
      return
    }
    setFile(picked)
    if (picked) setRemoveExisting(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      // Persist all three figures: the base and VAT for accounting, and the
      // gross in `amount` so every existing total and chart stays correct.
      const base = nullifyBlanks({
        ...form,
        net_amount: totals.net,
        tax_rate: Number(form.tax_rate || 0),
        tax_amount: totals.tax,
        amount: totals.gross,
        reimbursable,
      })

      if (expense) {
        let invoicePath = expense.invoice_path
        let invoiceName = expense.invoice_name

        if (removeExisting && expense.invoice_path) {
          await removeInvoice(expense.invoice_path)
          invoicePath = null
          invoiceName = null
        }
        if (file) {
          // Replace: drop the old object so storage does not accumulate orphans.
          if (invoicePath) await removeInvoice(invoicePath)
          invoicePath = await uploadInvoice(expense.id, file)
          invoiceName = file.name
        }

        await updateExpense(expense.id, {
          ...base,
          invoice_path: invoicePath,
          invoice_name: invoiceName,
        })
        onSaved('Expense saved.')
      } else {
        // The upload path is namespaced by expense id, so the row must exist
        // first. If the upload then fails, the expense is still saved and the
        // user is told the invoice specifically did not attach.
        const created = await createExpenseReturning(base)
        if (file) {
          try {
            const path = await uploadInvoice(created.id, file)
            await updateExpense(created.id, { invoice_path: path, invoice_name: file.name })
          } catch (uploadErr) {
            onSaved(
              `Expense saved, but the invoice did not upload: ${
                uploadErr instanceof Error ? uploadErr.message : 'unknown error'
              }`,
            )
            return
          }
        }
        onSaved('Expense saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the expense.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={expense ? 'Edit expense' : 'New expense'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="expense-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save expense'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Field label="Description">
          <input
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Flights to Rotterdam"
            required
          />
        </Field>

        {/* Direct vs structural — the split the dashboard reports on. */}
        <Field label="Cost type">
          <div className="grid grid-cols-2 gap-2">
            {COST_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => set('cost_type', type.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  form.cost_type === type.id
                    ? 'border-brand bg-brand-soft'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <span
                  className={`block text-sm font-medium ${
                    form.cost_type === type.id ? 'text-brand-ink' : 'text-ink'
                  }`}
                >
                  {type.label}
                </span>
                <span className="text-subtle block text-xs">{type.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Taxable base">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              value={form.net_amount}
              onChange={(e) => set('net_amount', e.target.value)}
              required
            />
          </Field>
          <Field label="VAT %">
            <select
              className="input"
              value={form.tax_rate}
              onChange={(e) => set('tax_rate', e.target.value)}
            >
              {TAX_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
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
          <Field label="Date">
            <input
              type="date"
              className="input"
              value={form.spent_on}
              onChange={(e) => set('spent_on', e.target.value)}
              required
            />
          </Field>
        </div>

        {/* Running total, so the figure on the invoice can be checked. */}
        <div className="border-line bg-canvas flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2.5">
          <span className="text-subtle text-xs">
            Base {formatMoney(totals.net, form.currency)} · VAT{' '}
            {formatMoney(totals.tax, form.currency)} at {form.tax_rate || 0}%
          </span>
          <span className="text-ink text-sm font-semibold">
            Total {formatMoney(totals.gross, form.currency)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select
              className="input"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier" hint="The company that issued the invoice.">
            <input
              className="input"
              value={form.vendor}
              onChange={(e) => set('vendor', e.target.value)}
              placeholder="Amazon Web Services"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Payment method">
            <select
              className="input"
              value={form.payment_method}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {/* A legacy value stays in the list only while it is in use. */}
              {(PAYMENT_METHODS.includes(form.payment_method as PaymentMethod)
                ? PAYMENT_METHODS
                : [form.payment_method as PaymentMethod, ...PAYMENT_METHODS]
              ).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="input capitalize"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {EXPENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="border-line flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5">
          <input
            type="checkbox"
            checked={reimbursable}
            onChange={(e) => setReimbursable(e.target.checked)}
            className="accent-brand mt-0.5 h-4 w-4"
          />
          <span>
            <span className="text-ink block text-sm font-medium">Reimbursable</span>
            <span className="text-subtle block text-xs">
              Paid out of pocket — the company owes this back to whoever paid.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Paid by"
            hint={
              profiles.length <= 1
                ? 'Teammates appear here once they have signed in.'
                : undefined
            }
          >
            <select
              className="input"
              value={form.paid_by}
              onChange={(e) => set('paid_by', e.target.value)}
            >
              <option value="">— Not recorded —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? 'Unnamed'}
                  {p.id === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice number">
            <input
              className="input"
              value={form.invoice_number}
              onChange={(e) => set('invoice_number', e.target.value)}
              placeholder="INV-2026-0134"
            />
          </Field>
        </div>

        <Field label="Invoice document" hint="PDF or photo, up to 10 MB.">
          <div className="space-y-2">
            {/* Existing attachment, when editing */}
            {expense?.invoice_path && !file && !removeExisting && (
              <div className="border-line bg-canvas flex items-center gap-2 rounded-lg border px-3 py-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="text-brand h-4 w-4 shrink-0">
                  <path d="M4 3h7l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V7h2.5L11 4.5Z" />
                </svg>
                <span className="text-ink min-w-0 flex-1 truncate text-sm">
                  {expense.invoice_name ?? 'Attached invoice'}
                </span>
                <button
                  type="button"
                  className="text-danger shrink-0 text-xs hover:underline"
                  onClick={() => setRemoveExisting(true)}
                >
                  Remove
                </button>
              </div>
            )}

            {removeExisting && (
              <div className="border-line bg-canvas flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="text-muted min-w-0 flex-1 text-sm">
                  Invoice will be removed when you save.
                </span>
                <button
                  type="button"
                  className="text-brand shrink-0 text-xs hover:underline"
                  onClick={() => setRemoveExisting(false)}
                >
                  Keep
                </button>
              </div>
            )}

            <input
              type="file"
              accept={ACCEPTED_INVOICE}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="text-muted file:bg-brand-soft file:text-brand-ink hover:file:bg-brand/20 w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
            />

            {file && (
              <p className="text-ok-ink text-xs">
                {file.name} ({(file.size / 1024).toFixed(0)} KB) will be
                {expense?.invoice_path ? ' uploaded, replacing the current file.' : ' uploaded.'}
              </p>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Client" hint="Which client this cost belongs to.">
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
          <Field label="Project" hint="The deal or project this cost is charged to.">
            <select
              className="input"
              value={form.deal_id}
              onChange={(e) => set('deal_id', e.target.value)}
            >
              <option value="">— None —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
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
