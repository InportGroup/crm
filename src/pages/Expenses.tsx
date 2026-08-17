import { useMemo, useState, type FormEvent } from 'react'
import {
  createExpense,
  deleteExpense,
  listCompanies,
  listDeals,
  listExpenses,
  nullifyBlanks,
  updateExpense,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  type Company,
  type Deal,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type PaymentMethod,
} from '../lib/types'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, Field, PageHeader, SkeletonList } from '../components/ui'

interface Data {
  expenses: Expense[]
  companies: Company[]
  deals: Deal[]
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
    const [expenses, companies, deals] = await Promise.all([
      listExpenses(),
      listCompanies(),
      listDeals(),
    ])
    return { expenses, companies, deals }
  })

  const { toast, confirm } = useFeedback()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all')
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const companyNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.companies.forEach((c) => map.set(c.id, c.name))
    return map
  }, [data])

  const visible = useMemo(() => {
    const expenses = data?.expenses ?? []
    const q = search.trim().toLowerCase()
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (!q) return true
      return [e.description, e.vendor, e.category, e.notes]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    })
  }, [data, search, statusFilter])

  const totals = useMemo(() => {
    const expenses = data?.expenses ?? []
    const month = todayISO().slice(0, 7)
    const sum = (list: Expense[]) => list.reduce((t, e) => t + Number(e.amount), 0)
    return {
      thisMonth: sum(expenses.filter((e) => e.spent_on.startsWith(month))),
      pending: sum(expenses.filter((e) => e.status === 'pending')),
      awaitingReimbursement: sum(expenses.filter((e) => e.status === 'approved')),
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

  async function setStatus(expense: Expense, status: ExpenseStatus) {
    try {
      await updateExpense(expense.id, { status })
      reload()
      toast(`Marked ${status}.`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update.', 'error')
    }
  }

  async function onDelete(expense: Expense) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `“${expense.description}” will be removed for everyone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await deleteExpense(expense.id)
    reload()
    toast('Expense deleted.')
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
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Total label="This month" value={formatCurrency(totals.thisMonth)} />
          <Total label="Pending approval" value={formatCurrency(totals.pending)} tone="warn" />
          <Total
            label="To reimburse"
            value={formatCurrency(totals.awaitingReimbursement)}
            tone="info"
          />
          <Total label="All time" value={formatCurrency(totals.all)} />
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : data && data.expenses.length === 0 ? (
        <EmptyState
          title="No expenses logged"
          description="Record internal spend — travel, software, office costs — and track it through approval."
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

          {byCategory.length > 1 && (
            <section className="card mb-4 p-5">
              <h2 className="text-ink text-sm font-semibold">By category</h2>
              <ul className="mt-3 space-y-2.5">
                {byCategory.map(([cat, value]) => (
                  <li key={cat}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted capitalize">{cat}</span>
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
                    <p className="text-subtle truncate text-xs capitalize">
                      {expense.category} · {formatDate(expense.spent_on)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ink text-sm font-semibold">
                      {formatCurrency(Number(expense.amount), expense.currency)}
                    </p>
                    <span className={`badge mt-1 ${STATUS_STYLES[expense.status]}`}>
                      {expense.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
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
                    <th className="th">Category</th>
                    <th className="th">Date</th>
                    <th className="th">Vendor</th>
                    <th className="th text-right">Amount</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {visible.map((expense) => (
                    <tr key={expense.id} className="hover:bg-canvas transition-colors">
                      <td className="td">
                        <p className="text-ink font-medium">{expense.description}</p>
                        {expense.company_id && (
                          <p className="text-subtle text-xs">
                            {companyNames.get(expense.company_id)}
                          </p>
                        )}
                      </td>
                      <td className="td capitalize">{expense.category}</td>
                      <td className="td">{formatDate(expense.spent_on)}</td>
                      <td className="td">{expense.vendor ?? '—'}</td>
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
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
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
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            toast('Expense saved.')
          }}
        />
      )}
    </>
  )
}

function Total({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn' | 'info'
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-subtle text-xs">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold tracking-tight ${
          tone === 'warn' ? 'text-warn-ink' : tone === 'info' ? 'text-info-ink' : 'text-ink'
        }`}
      >
        {value}
      </p>
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

function ExpenseForm({
  expense,
  companies,
  deals,
  onClose,
  onSaved,
}: {
  expense: Expense | null
  companies: Company[]
  deals: Deal[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    amount: String(expense?.amount ?? ''),
    currency: expense?.currency ?? 'EUR',
    category: expense?.category ?? ('other' as ExpenseCategory),
    spent_on: expense?.spent_on ?? todayISO(),
    vendor: expense?.vendor ?? '',
    payment_method: expense?.payment_method ?? ('card' as PaymentMethod),
    status: expense?.status ?? ('pending' as ExpenseStatus),
    company_id: expense?.company_id ?? '',
    deal_id: expense?.deal_id ?? '',
    notes: expense?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const values = nullifyBlanks({ ...form, amount: Number(form.amount || 0) })
      if (expense) await updateExpense(expense.id, values)
      else await createExpense(values)
      onSaved()
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

        <div className="grid grid-cols-3 gap-3">
          <Field label="Amount">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select
              className="input capitalize"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment method">
            <select
              className="input capitalize"
              value={form.payment_method}
              onChange={(e) => set('payment_method', e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Vendor">
            <input
              className="input"
              value={form.vendor}
              onChange={(e) => set('vendor', e.target.value)}
              placeholder="KLM"
            />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company" hint="Optional — if billable to a client.">
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
          <Field label="Deal">
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
