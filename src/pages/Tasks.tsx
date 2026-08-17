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
import { formatDate, fullName, isOverdue } from '../lib/format'
import { PRIORITIES, type Contact, type Deal, type Priority, type Task } from '../lib/types'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  PriorityBadge,
  Spinner,
} from '../components/ui'

interface Data {
  tasks: Task[]
  contacts: Contact[]
  deals: Deal[]
}

type Filter = 'open' | 'done' | 'all'

export function Tasks() {
  const { data, loading, error, reload } = useAsyncData<Data>(async () => {
    const [tasks, contacts, deals] = await Promise.all([listTasks(), listContacts(), listDeals()])
    return { tasks, contacts, deals }
  })

  const [filter, setFilter] = useState<Filter>('open')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [toggleError, setToggleError] = useState('')

  const contactNames = useMemo(() => {
    const map = new Map<string, string>()
    data?.contacts.forEach((c) => map.set(c.id, fullName(c.first_name, c.last_name)))
    return map
  }, [data])

  const visible = useMemo(() => {
    const tasks = data?.tasks ?? []
    if (filter === 'all') return tasks
    return tasks.filter((t) => (filter === 'done' ? t.completed : !t.completed))
  }, [data, filter])

  async function toggle(task: Task) {
    setToggleError('')
    try {
      await updateTask(task.id, {
        completed: !task.completed,
        completed_at: task.completed ? null : new Date().toISOString(),
      })
      reload()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Could not update the task.')
    }
  }

  async function onDelete(task: Task) {
    if (!confirm(`Delete “${task.title}”?`)) return
    await deleteTask(task.id)
    reload()
  }

  const openCount = (data?.tasks ?? []).filter((t) => !t.completed).length

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open`}
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            New task
          </button>
        }
      />

      {error && <ErrorNote message={error} />}
      {toggleError && <ErrorNote message={toggleError} />}

      <div className="mb-4 inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {(['open', 'done', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'Nothing on your plate' : 'No tasks here'}
          description="Follow-ups you add will show up in this list and on the dashboard."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              New task
            </button>
          }
        />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {visible.map((task) => (
            <li key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => void toggle(task)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                aria-label={`Mark “${task.title}” as ${task.completed ? 'not done' : 'done'}`}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  {task.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {task.due_date && (
                    <span
                      className={
                        !task.completed && isOverdue(task.due_date)
                          ? 'font-medium text-red-600'
                          : undefined
                      }
                    >
                      Due {formatDate(task.due_date)}
                    </span>
                  )}
                  {task.contact_id && <span>{contactNames.get(task.contact_id)}</span>}
                  {task.description && <span className="truncate">{task.description}</span>}
                </div>
              </div>

              <PriorityBadge priority={task.priority} />

              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1"
                  onClick={() => setEditing(task)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
                  onClick={() => void onDelete(task)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
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
    } finally {
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

        <div className="grid grid-cols-2 gap-3">
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
