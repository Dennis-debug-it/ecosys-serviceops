import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAppStore } from '../store/appStore'
import { getDashboardMetrics, toWorkOrderView } from './selectors'

export function useTenantData() {
  const { session } = useAuth()
  const tenantId = session?.tenantId ?? ''
  const data = useAppStore((database) => (tenantId ? database.tenantData[tenantId] : undefined))

  return {
    tenantId,
    data,
    session,
  }
}

export function useWorkOrderViews() {
  const { data } = useTenantData()

  return useMemo(() => {
    if (!data) return []
    return data.workOrders.map((workOrder) => toWorkOrderView(data, workOrder))
  }, [data])
}

export function useDashboardData() {
  const { data } = useTenantData()

  return useMemo(() => getDashboardMetrics(data), [data])
}
