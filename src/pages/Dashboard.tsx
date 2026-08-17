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
  DEAL_STAGES,
  OPEN_STAGES,
  type Activity,
  type Contact,
  type Deal,
  type Expense,
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

    return {
      contacts: data?.contacts.length ?? 0,
      openDeals: open.length,
      pipeline: open.reduce((sum, d) => sum + Number(d.value), 0),
      won: won.reduce((sum, d) => sum + Number(d.value), 0),
      openTasks: tasks.filter((t) => !t.completed).length,
      overdue: tasks.filter((t) => !t.completed && isOverdue(t.due_date)).length,
      spendThisMonth: expenses
        .filter((e) => e.spent_on.startsWith(month))
        .reduce((sum, e) => sum + Number(e.amount), 0),
      pendingExpenses: expenses.filter((e) => e.status === 'pending').length,
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
            stats.pendingExpenses > 0
              ? `${stats.pendingExpenses} awaiting approval`
              : 'nothing pending'
          }
          hintTone={stats.pendingExpenses > 0 ? 'warn' : 'muted'}
          to="/expenses"
          // Full width on phones (odd tile in a 2-column grid), one column on xl.
          className="col-span-2 xl:col-span-1"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
