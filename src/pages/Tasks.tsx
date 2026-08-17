import { useMemo, useState, type FormEvent } from 'react'
import {
  createTask,
  deleteTask,
  listContacts,
  listDeals,
  listTasks,
  nullifyBlanks,
  updateTask,
} from '../lib/api'
import { useAsyncData } from '../hooks/useAsyncData'
import { useFeedback } from '../context/feedback'
import { formatDate, fullName, isOverdue, todayISO } from '../lib/format'
import { PRIORITIES, type Contact, type Deal, type Priority, type Task } from '../lib/types'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  PriorityBadge,
  SkeletonList,
} from '../components/ui'

interface Data {
  tasks: Task[]
  contacts: Contact[]
  deals: Deal[]
}

type Filter = 'open' | 'today' | 'done' | 'all'

export function Tasks() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [tasks, contacts, deals] = await Promise.all([listTasks(), listContacts(), listDeals()])
    return { tasks, contacts, deals }
  })

  const { toast, confirm } = useFeedback()
  const [filter, setFilter] = useState<Filter>('open')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)

  const contactNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.contacts.forEach((c) => map.set(c.id, fullName(c.first_name, c.last_name)))
    return map
  }, [data])

  const counts = useMemo(() => {
    const tasks = data?.tasks ?? []
    const today = todayISO()
    return {
      open: tasks.filter((t) => !t.completed).length,
      today: tasks.filter((t) => !t.completed && t.due_date && t.due_date <= today).length,
      overdue: tasks.filter((t) => !t.completed && isOverdue(t.due_date)).length,
    }
  }, [data])

  const visible = useMemo(() => {
    const tasks = data?.tasks ?? []
    const today = todayISO()
    switch (filter) {
      case 'open':
        return tasks.filter((t) => !t.completed)
      case 'today':
        return tasks.filter((t) => !t.completed && t.due_date && t.due_date <= today)
      case 'done':
        return tasks.filter((t) => t.completed)
      default:
        return tasks
    }
  }, [data, filter])

  async function toggle(task: Task) {
    try {
      await updateTask(task.id, {
        completed: !task.completed,
        completed_at: task.completed ? null : new Date().toISOString(),
      })
      reload()
      if (!task.completed) toast('Task completed.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the task.', 'error')
    }
  }

  async function onDelete(task: Task) {
    const ok = await confirm({
      title: `Delete “${task.title}”?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await deleteTask(task.id)
    reload()
    toast('Task deleted.')
  }

  const FILTERS: { id: Filter; label: string; count?: number }[] = [
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'today', label: 'Due', count: counts.today },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' },
  ]

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={
          counts.overdue > 0
            ? `${counts.open} open · ${counts.overdue} overdue`
            : `${counts.open} open`
        }
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New task
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="border-line bg-surface mb-4 inline-flex rounded-lg border p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-brand text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={filter === f.id ? 'ml-1.5 opacity-80' : 'text-subtle ml-1.5'}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'Nothing on your plate' : 'No tasks here'}
          description="Follow-ups you add show up here and on the dashboard."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New task
            </button>
          }
        />
      ) : (
        <ul className="card divide-line divide-y">
          {visible.map((task) => {
            const overdue = !task.completed && isOverdue(task.due_date)
            return (
              <li key={task.id} className="hover:bg-canvas flex items-start gap-3 px-4 py-3 transition-colors">
                <button
                  type="button"
                  onClick={() => void toggle(task)}
                  aria-label={`Mark “${task.title}” as ${task.completed ? 'not done' : 'done'}`}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    task.completed
                      ? 'border-brand bg-brand text-white'
                      : 'border-line-strong hover:border-brand'
                  }`}
                >
                  {task.completed && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(task)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={`text-sm font-medium ${
                      task.completed ? 'text-subtle line-through' : 'text-ink'
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="text-subtle mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {task.due_date && (
                      <span className={overdue ? 'text-danger font-medium' : undefined}>
                        {overdue ? 'Overdue · ' : 'Due '}
                        {formatDate(task.due_date)}
                      </span>
                    )}
                    {task.contact_id && <span>{contactNames.get(task.contact_id)}</span>}
                  </div>
                </button>

                <PriorityBadge priority={task.priority} />

                <button
                  type="button"
                  onClick={() => void onDelete(task)}
                  aria-label="Delete task"
                  className="text-subtle hover:text-danger rounded p-1 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M8 3h4a1 1 0 0 1 1 1v1h3v2h-1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7H4V5h3V4a1 1 0 0 1 1-1Zm1 2h2V4H9v1ZM7 7v8h6V7H7Z" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <TaskForm
          task={editing === 'new' ? null : editing}
          contacts={data?.contacts ?? []}
          deals={data?.deals ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            toast('Task saved.')
          }}
        />
      )}
    </>
  )
}

function TaskForm({
  task,
  contacts,
  deals,
  onClose,
  onSaved,
}: {
  task: Task | null
  contacts: Contact[]
  deals: Deal[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    due_date: task?.due_date ?? '',
    priority: task?.priority ?? ('medium' as Priority),
    contact_id: task?.contact_id ?? '',
    deal_id: task?.deal_id ?? '',
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
      if (task) await updateTask(task.id, values)
      else await createTask(values)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the task.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Field label="Title">
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <select
              className="input"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <Field label="Description">
          <textarea
            className="input min-h-24"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
