import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { createActivity, deleteActivity } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { ACTIVITY_TYPES, type Activity, type ActivityType } from '../lib/types'
import { useFeedback } from '../context/feedback'
import { ErrorNote } from './ui'

interface Scope {
  contactId?: string
  companyId?: string
  dealId?: string
}

const TYPE_STYLE: Record<ActivityType, { badge: string; icon: string }> = {
  note: { badge: 'bg-neutral-soft text-neutral-ink', icon: 'M4 4h12v9l-3 3H4V4Zm8 12v-3h3l-3 3Z' },
  call: {
    badge: 'bg-ok-soft text-ok-ink',
    icon: 'M5 3a2 2 0 0 0-2 2c0 6.6 5.4 12 12 12a2 2 0 0 0 2-2v-2a1 1 0 0 0-.8-1l-3-.6a1 1 0 0 0-1 .4l-.8 1a10 10 0 0 1-4.2-4.2l1-.8a1 1 0 0 0 .4-1l-.6-3A1 1 0 0 0 7 3H5Z',
  },
  email: {
    badge: 'bg-info-soft text-info-ink',
    icon: 'M3 5h14v10H3V5Zm1.6 1L10 9.9 15.4 6H4.6Z',
  },
  meeting: {
    badge: 'bg-brand-soft text-brand-ink',
    icon: 'M6 2v2H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2V2h-2v2H8V2H6ZM5 8h10v7H5V8Z',
  },
}

/**
 * Timeline for one record, with an inline composer. Queries are scoped by
 * whichever id is supplied, so the same component serves contacts and deals.
 */
export function ActivityFeed(scope: Scope) {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<ActivityType>('note')
  const [busy, setBusy] = useState(false)

  const { contactId, companyId, dealId } = scope

  useEffect(() => {
    let active = true
    setLoading(true)

    let query = supabase.from('activities').select('*').order('occurred_at', { ascending: false })
    if (contactId) query = query.eq('contact_id', contactId)
    if (companyId) query = query.eq('company_id', companyId)
    if (dealId) query = query.eq('deal_id', dealId)

    query.then(({ data, error: err }) => {
      if (!active) return
      if (err) setError(err.message)
      else {
        setItems((data ?? []) as Activity[])
        setError('')
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [contactId, companyId, dealId])

  async function reload() {
    let query = supabase.from('activities').select('*').order('occurred_at', { ascending: false })
    if (contactId) query = query.eq('contact_id', contactId)
    if (companyId) query = query.eq('company_id', companyId)
    if (dealId) query = query.eq('deal_id', dealId)
    const { data } = await query
    setItems((data ?? []) as Activity[])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    try {
      await createActivity({
        body: body.trim(),
        type,
        contact_id: contactId ?? null,
        company_id: companyId ?? null,
        deal_id: dealId ?? null,
      })
      setBody('')
      await reload()
      toast('Activity logged.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not log the activity.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this entry?',
      message: 'It will be removed from the timeline for everyone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await deleteActivity(id)
    await reload()
    toast('Entry deleted.')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="border-line bg-canvas rounded-xl border p-3">
        <textarea
          className="input min-h-16 resize-y"
          placeholder="Log a call, note, email or meeting…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-1">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`badge capitalize transition-colors ${
                  type === t ? TYPE_STYLE[t].badge : 'text-subtle hover:bg-neutral-soft'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary py-1.5" disabled={busy || !body.trim()}>
            {busy ? 'Saving…' : 'Log'}
          </button>
        </div>
      </form>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <p className="text-muted py-4 text-center text-sm">Loading timeline…</p>
      ) : items.length === 0 ? (
        <p className="text-muted py-4 text-center text-sm">
          No activity yet. Anything you log here is visible to the whole team.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="group flex gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TYPE_STYLE[item.type].badge}`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d={TYPE_STYLE[item.type].icon} />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink text-sm whitespace-pre-wrap">{item.body}</p>
                <p className="text-subtle mt-0.5 text-xs capitalize">
                  {item.type} · {formatDateTime(item.occurred_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDelete(item.id)}
                aria-label="Delete entry"
                className="text-subtle hover:text-danger h-fit rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M8 3h4a1 1 0 0 1 1 1v1h3v2h-1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7H4V5h3V4a1 1 0 0 1 1-1Zm1 2h2V4H9v1ZM7 7v8h6V7H7Z" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
