import { useCallback, useEffect, useState } from 'react'

interface AsyncData<T> {
  data: T | null
  loading: boolean
  error: string
  /** Re-runs the loader. Pass to child components after a mutation. */
  reload: () => void
}

/**
 * Runs `loader` on mount and whenever `reload()` is called. Results arriving
 * after unmount (or after a newer run started) are discarded.
 */
export function useAsyncData<T>(loader: () => Promise<T>): AsyncData<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  // `loader` is re-created on every render by callers, so it is deliberately
  // not a dependency; `nonce` is the explicit refresh signal instead.
  const loaderRef = useLatest(loader)

  useEffect(() => {
    let active = true
    setLoading(true)

    loaderRef
      .current()
      .then((result) => {
        if (!active) return
        setData(result)
        setError('')
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [nonce, loaderRef])

  return { data, loading, error, reload }
}

function useLatest<T>(value: T) {
  const [ref] = useState(() => ({ current: value }))
  ref.current = value
  return ref
}
