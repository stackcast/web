import { useCallback, useEffect, useRef, useState } from 'react'

interface UseApiQueryOptions {
  enabled?: boolean
  refreshIntervalMs?: number
  watch?: unknown[]
}

export interface UseApiQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isRefetching: boolean
  error: Error | undefined
  refetch: () => Promise<void>
}

export function useApiQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const { enabled = true, refreshIntervalMs, watch = [] } = options

  const [data, setData] = useState<T>()
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [isRefetching, setIsRefetching] = useState<boolean>(false)
  const [error, setError] = useState<Error>()

  const controllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runFetch = useCallback(
    async (isInitial = false) => {
      if (!enabled) return

      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      if (isInitial) {
        setIsLoading(true)
      } else {
        setIsRefetching(true)
      }
      setError(undefined)

      try {
        const nextData = await fetcher(controller.signal)
        setData(nextData)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err as Error)
        }
      } finally {
        controllerRef.current = null
        setIsLoading(false)
        setIsRefetching(false)
      }
    },
    [enabled, fetcher]
  )

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    runFetch(true)

    return () => {
      controllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, runFetch, ...watch])

  useEffect(() => {
    if (!refreshIntervalMs || !enabled) {
      return
    }

    intervalRef.current = setInterval(() => {
      runFetch(false)
    }, refreshIntervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, refreshIntervalMs, runFetch])

  const refetch = useCallback(async () => {
    await runFetch(false)
  }, [runFetch])

  return { data, isLoading, isRefetching, error, refetch }
}
