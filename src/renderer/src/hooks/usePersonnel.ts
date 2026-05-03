import { useState, useEffect, useCallback } from 'react'
import type { PersonnelListItem, Personnel } from '@shared/types/personnel'

interface PersonnelFilters {
  search?: string
  subdivision?: string
  statusCode?: string
  category?: string
  status?: string
}

interface UsePersonnelListResult {
  data: PersonnelListItem[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePersonnelList(filters: PersonnelFilters = {}): UsePersonnelListResult {
  const [data, setData] = useState<PersonnelListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refetch = useCallback(() => setTrigger((t) => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    window.api
      .personnelList(filters)
      .then((result) => {
        setData(result ?? [])
      })
      .catch((err) => {
        setError(String(err))
        setData([])
      })
      .finally(() => setLoading(false))
  }, [
    filters.search,
    filters.subdivision,
    filters.statusCode,
    filters.category,
    filters.status,
    trigger
  ])

  return { data, loading, error, refetch }
}

interface PersonnelCardData extends Personnel {
  rankName?: string | null
  rankCategory?: string | null
  positionTitle?: string | null
  statusName?: string | null
  statusColorCode?: string | null
  educationLevelName?: string | null
  tccName?: string | null
}

interface UsePersonnelCardResult {
  data: PersonnelCardData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePersonnelCard(id: number | null): UsePersonnelCardResult {
  const [data, setData] = useState<PersonnelCardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refetch = useCallback(() => setTrigger((t) => t + 1), [])

  useEffect(() => {
    if (!id) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    window.api
      .personnelGet(id)
      .then((result) => {
        setData(result)
      })
      .catch((err) => {
        setError(String(err))
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [id, trigger])

  return { data, loading, error, refetch }
}
