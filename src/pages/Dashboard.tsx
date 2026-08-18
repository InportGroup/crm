import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listActivities, listContacts, listDeals, listExpenses, listTasks } from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../context/auth'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  fullName,
  isOverdue,
  todayISO,
} from '../lib/format'
import {
  CATEGORY_LABELS,
  DEAL_STAGES,
  OPEN_STAGES,
  type Activity,
  type Contact,
  type Deal,
  type Expense,
  type ExpenseCategory,
  type Task,
} from '../lib/types'
import { ErrorNote, PageHeader, PriorityBadge, Spinner } from '../components/ui'

interface Data {
  contacts: Contact[]
  deals: Deal[]
  tasks: Task[]
  activities: Activity[]
  expenses: Expense[]
}

export function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error } = useAsyncData<Data>(async () => {
    const [contacts, deals, tasks, activities, expenses] = await Promise.all([
      listContacts(),
      listDeals(),
      listTasks(),
      listActivities(8),
      listExpenses(),
    ])
    return { contacts, deals, tasks, activities, expenses }
  })

  const stats = useMemo(() => {
    const deals = data?.deals ?? []
    const tasks = data?.tasks ?? []
    const expenses = data?.expenses ?? []
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const won = deals.filter((d) => d.stage === 'won')
    // todayISO is timezone-aware; toISOString would be UTC and could land in
    // the wrong month for anyone west of Greenwich late in the evening.
    const month = todayISO().slice(0, 7)
    const monthly = expenses.filter((e) => e.spent_on.startsWith(month))

    return {
      contacts: data?.contacts.length ?? 0,
      openDeals: open.length,
      pipeline: open.reduce((sum, d) => sum + Number(d.value), 0),
      won: won.reduce((sum, d) => sum + Number(d.value), 0),
      openTasks: tasks.filter((t) => !t.completed).length,
      overdue: tasks.filter((t) => !t.completed && isOverdue(t.due_date)).length,
      spendThisMonth: monthly.reduce((sum, e) => sum + Number(e.amount), 0),
      pendingExpenses: expenses.filter((e) => e.status === 'pending').length,
    }
  }, [data])

  /**
   * The month's spend split into costs that belong to a project or client and
   * overhead the company carries either way. Both the gross figure and the
   * taxable base are kept: the base is what actually lands in the accounts.
   */
  const costSplit = useMemo(() => {
    const monthly = (data?.expenses ?? []).filter((e) => e.spent_on.startsWith(todayISO().slice(0, 7)))

    const bucket = (type: 'direct' | 'structural') => {
      const rows = monthly.filter((e) => e.cost_type === type)
      const byCategory = new Map<ExpenseCategory, number>()
      rows.forEach((e) =>
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount)),
      )
      return {
        gross: rows.reduce((sum, e) => sum + Number(e.amount), 0),
        net: rows.reduce((sum, e) => sum + Number(e.net_amount ?? 0), 0),
        tax: rows.reduce((sum, e) => sum + Number(e.tax_amount ?? 0), 0),
        count: rows.length,
        categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      }
    }

    const direct = bucket('direct')
    const structural = bucket('structural')
    const total = direct.gross + structural.gross
    return {
      direct,
      structural,
      total,
      // Share of spend that is billable, the number worth watching month to month.
      directShare: total > 0 ? Math.round((direct.gross / total) * 100) : 0,
    }
  }, [data])

  /** Out-of-pocket spend still waiting to be paid back. */
  const owed = useMemo(() => {
    const rows = (data?.expenses ?? []).filter(
      (e) => e.reimbursable && e.status !== 'reimbursed' && e.status !== 'rejected',
    )
    return {
      total: rows.reduce((sum, e) => sum + Number(e.amount), 0),
      count: rows.length,
    }
  }, [data])

  const stageTotals = useMemo(() => {
    const deals = data?.deals ?? []
    return DEAL_STAGES.map((stage) => {
      const inStage = deals.filter((d) => d.stage === stage.id)
      return {
        ...stage,
        count: inStage.length,
        value: inStage.reduce((sum, d) => sum + Number(d.value), 0),
      }
    })
  }, [data])

  const maxStageValue = Math.max(1, ...stageTotals.map((s) => s.value))

  const upcoming = useMemo(
    () => (data?.tasks ?? []).filter((t) => !t.completed).slice(0, 6),
    [data],
  )

  const contactNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.contacts.forEach((c) => map.set(c.id, fullName(c.first_name, c.last_name)))
    return map
  }, [data])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
  }, [])

  if (loading) return <Spinner />

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0]

  return (
    <>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        subtitle="Where things stand right now"
      />

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Contacts" value={String(stats.contacts)} to="/contacts" />
        <Stat
          label="Open pipeline"
          value={formatCurrency(stats.pipeline)}
          hint={`${stats.openDeals} open deal${stats.openDeals === 1 ? '' : 's'}`}
          to="/deals"
        />
        <Stat label="Won" value={formatCurrency(stats.won)} to="/deals" />
        <Stat
          label="Open tasks"
          value={String(stats.openTasks)}
          hint={stats.overdue > 0 ? `${stats.overdue} overdue` : 'nothing overdue'}
          hintTone={stats.overdue > 0 ? 'danger' : 'muted'}
          to="/tasks"
        />
        <Stat
          label="Spend this month"
          value={formatCurrency(stats.spendThisMonth)}
          hint={
            owed.count > 0
              ? `${formatCurrency(owed.total)} to reimburse`
              : stats.pendingExpenses > 0
                ? `${stats.pendingExpenses} awaiting approval`
                : 'nothing pending'
          }
          hintTone={owed.count > 0 || stats.pendingExpenses > 0 ? 'warn' : 'muted'}
          to="/expenses"
          // Full width on phones (odd tile in a 2-column grid), one column on xl.
          className="col-span-2 xl:col-span-1"
        />
      </div>

      {costSplit.total > 0 && (
        <section className="card mt-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-ink text-sm font-semibold">Cost structure this month</h2>
              <p className="text-subtle mt-0.5 text-xs">
                Direct costs sit against a project or client; structural costs are overhead
              </p>
            </div>
            <Link to="/expenses" className="text-brand text-sm font-medium hover:underline">
              All expenses
            </Link>
          </div>

          {/* One bar showing the balance between the two, before the detail. */}
          <div className="bg-neutral-soft mt-4 flex h-2.5 overflow-hidden rounded-full">
            <div
              className="bg-brand h-full transition-all duration-500"
              style={{ width: `${costSplit.directShare}%` }}
            />
            <div
              className="bg-info-ink h-full transition-all duration-500"
              style={{ width: `${100 - costSplit.directShare}%` }}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CostBucket
              label="Direct costs"
              hint="Billable to a project or client"
              accent="bg-brand"
              share={costSplit.directShare}
              bucket={costSplit.direct}
            />
            <CostBucket
              label="Structural costs"
              hint="General running costs"
              accent="bg-info-ink"
              share={100 - costSplit.directShare}
              bucket={costSplit.structural}
            />
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-ink text-sm font-semibold">Pipeline by stage</h2>
          <ul className="mt-4 space-y-3">
            {stageTotals.map((stage) => (
              <li key={stage.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted">
                    {stage.label}
                    <span className="text-subtle ml-1.5 text-xs">{stage.count}</span>
                  </span>
                  <span className="text-ink font-medium">{formatCurrency(stage.value)}</span>
                </div>
                <div className="bg-neutral-soft mt-1.5 h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stage.id === 'won'
                        ? 'bg-ok-ink'
                        : stage.id === 'lost'
                          ? 'bg-danger'
                          : 'bg-brand'
                    }`}
                    style={{ width: `${(stage.value / maxStageValue) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-ink text-sm font-semibold">Next up</h2>
            <Link to="/tasks" className="text-brand text-sm font-medium hover:underline">
              All tasks
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-muted mt-4 text-sm">No open tasks. Nice.</p>
          ) : (
            <ul className="divide-line mt-3 divide-y">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm font-medium">{task.title}</p>
                    <p className="text-subtle text-xs">
                      {task.due_date ? (
                        <span className={isOverdue(task.due_date) ? 'text-danger font-medium' : ''}>
                          Due {formatDate(task.due_date)}
                        </span>
                      ) : (
                        'No due date'
                      )}
                      {task.contact_id && ` · ${contactNames.get(task.contact_id) ?? ''}`}
                    </p>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 p-5">
        <h2 className="text-ink text-sm font-semibold">Recent activity</h2>
        {(data?.activities.length ?? 0) === 0 ? (
          <p className="text-muted mt-4 text-sm">
            Nothing logged yet. Open a contact or deal and log a call, note, email or meeting — the
            whole team sees it.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data?.activities.map((activity) => (
              <li key={activity.id} className="flex gap-3">
                <span className="badge bg-neutral-soft text-neutral-ink mt-0.5 h-fit capitalize">
                  {activity.type}
                </span>
                <div className="min-w-0">
                  <p className="text-muted text-sm">{activity.body}</p>
                  <p className="text-subtle text-xs">{formatDateTime(activity.occurred_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function CostBucket({
  label,
  hint,
  accent,
  share,
  bucket,
}: {
  label: string
  hint: string
  accent: string
  share: number
  bucket: {
    gross: number
    net: number
    tax: number
    count: number
    categories: [ExpenseCategory, number][]
  }
}) {
  const max = Math.max(1, ...bucket.categories.map(([, v]) => v))

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          {label}
        </span>
        <span className="text-ink font-semibold">{formatCurrency(bucket.gross)}</span>
      </div>
      <p className="text-subtle mt-0.5 text-xs">
        {hint} · {share}% of spend
      </p>
      <p className="text-subtle mt-1 text-xs">
        Base {formatCurrency(bucket.net)} · VAT {formatCurrency(bucket.tax)} · {bucket.count}{' '}
        {bucket.count === 1 ? 'expense' : 'expenses'}
      </p>

      {bucket.categories.length > 0 && (
        <ul className="mt-3 space-y-2">
          {bucket.categories.map(([category, value]) => (
            <li key={category}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted">{CATEGORY_LABELS[category] ?? category}</span>
                <span className="text-ink font-medium">{formatCurrency(value)}</span>
              </div>
              <div className="bg-neutral-soft mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${accent}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  hintTone = 'muted',
  to,
  className = '',
}: {
  label: string
  value: string
  hint?: string
  hintTone?: 'muted' | 'danger' | 'warn'
  to: string
  className?: string
}) {
  const hintColor =
    hintTone === 'danger' ? 'text-danger' : hintTone === 'warn' ? 'text-warn-ink' : 'text-subtle'
  return (
    <Link
      to={to}
      className={`card hover:border-brand/40 p-4 transition-colors sm:p-5 ${className}`}
    >
      <p className="text-muted text-sm">{label}</p>
      <p className="text-ink mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {hint && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
    </Link>
  )
}
