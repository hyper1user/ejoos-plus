import { useState, useEffect, useCallback } from 'react'
import type { DgvMonthData } from '@shared/types/dgv'

interface UseDgvMonthResult {
  data: DgvMonthData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDgvMonth(year: number, month: number): UseDgvMonthResult {
  const [data, setData] = useState<DgvMonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refetch = useCallback(() => setTrigger((t) => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    window.api
      .dgvGetMonth(year, month)
      .then((result: DgvMonthData) => {
        setData(result ?? null)
      })
      .catch((err: unknown) => {
        setError(String(err))
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [year, month, trigger])

  return { data, loading, error, refetch }
}
