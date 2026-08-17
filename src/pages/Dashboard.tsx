import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listActivities, listContacts, listDeals, listTasks } from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCurrency, formatDate, formatDateTime, fullName, isOverdue } from '../lib/format'
import {
  DEAL_STAGES,
  OPEN_STAGES,
  type Activity,
  type Contact,
  type Deal,
  type Task,
} from '../lib/types'
import { ErrorNote, PageHeader, PriorityBadge, Spinner } from '../components/ui'

interface Data {
  contacts: Contact[]
  deals: Deal[]
  tasks: Task[]
  activities: Activity[]
}

export function Dashboard() {
  const { data, loading, error } = useAsyncData<Data>(async () => {
    const [contacts, deals, tasks, activities] = await Promise.all([
      listContacts(),
      listDeals(),
      listTasks(),
      listActivities(8),
    ])
    return { contacts, deals, tasks, activities }
  })

  const stats = useMemo(() => {
    const deals = data?.deals ?? []
    const tasks = data?.tasks ?? []
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const won = deals.filter((d) => d.stage === 'won')

    return {
      contacts: data?.contacts.length ?? 0,
      openDeals: open.length,
      pipeline: open.reduce((sum, d) => sum + Number(d.value), 0),
      won: won.reduce((sum, d) => sum + Number(d.value), 0),
      openTasks: tasks.filter((t) => !t.completed).length,
      overdue: tasks.filter((t) => !t.completed && isOverdue(t.due_date)).length,
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

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Where things stand right now" />

      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Pipeline by stage</h2>
          <ul className="mt-4 space-y-3">
            {stageTotals.map((stage) => (
              <li key={stage.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">
                    {stage.label}
                    <span className="ml-1.5 text-xs text-slate-400">{stage.count}</span>
                  </span>
                  <span className="font-medium text-slate-800">{formatCurrency(stage.value)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      stage.id === 'won'
                        ? 'bg-emerald-500'
                        : stage.id === 'lost'
                          ? 'bg-red-400'
                          : 'bg-indigo-500'
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
            <h2 className="text-sm font-semibold text-slate-900">Next up</h2>
            <Link to="/tasks" className="text-sm font-medium text-indigo-600 hover:underline">
              All tasks
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No open tasks. Nice.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.due_date ? (
                        <span className={isOverdue(task.due_date) ? 'font-medium text-red-600' : ''}>
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

      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        {(data?.activities.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nothing logged yet. Calls, emails and notes you record will appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data?.activities.map((activity) => (
              <li key={activity.id} className="flex gap-3">
                <span className="badge mt-0.5 h-fit bg-slate-100 text-slate-600">
                  {activity.type}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{activity.body}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(activity.occurred_at)}</p>
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
}: {
  label: string
  value: string
  hint?: string
  hintTone?: 'muted' | 'danger'
  to: string
}) {
  return (
    <Link to={to} className="card p-5 transition-colors hover:border-indigo-300">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && (
        <p className={`mt-1 text-xs ${hintTone === 'danger' ? 'text-red-600' : 'text-slate-400'}`}>
          {hint}
        </p>
      )}
    </Link>
  )
}
