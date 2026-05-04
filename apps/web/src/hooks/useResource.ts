import { useCallback, useEffect, useState } from 'react'

export type ResourceState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
  refresh: () => Promise<void>
}

export function useResource<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[],
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const next = await loader()
      setData(next)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, isLoading, refresh }
}
