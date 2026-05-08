import { deriveSlaStatus } from '../utils/date'
import { tenantService } from './tenantService'
import type { WorkOrderStatus } from '../types/app'

type ReportFilters = {
  dateFrom?: string
  dateTo?: string
  clientId?: string
  branchId?: string
  status?: WorkOrderStatus | 'All'
}

function applyFilters<T extends { createdAt?: string; clientId?: string; branchId?: string; status?: string }>(rows: T[], filters: ReportFilters) {
  return rows.filter((row) => {
    const created = row.createdAt ? new Date(row.createdAt).getTime() : 0
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined
    const to = filters.dateTo ? new Date(filters.dateTo).getTime() : undefined
    return (
      (!from || created >= from) &&
      (!to || created <= to) &&
      (!filters.clientId || row.clientId === filters.clientId) &&
      (!filters.branchId || row.branchId === filters.branchId) &&
      (!filters.status || filters.status === 'All' || row.status === filters.status)
    )
  })
}

export const reportService = {
  build(tenantId: string, filters: ReportFilters) {
    const data = tenantService.getTenantData(tenantId)
    const workOrders = applyFilters(data.workOrders, filters).map((workOrder) => ({ ...workOrder, slaStatus: deriveSlaStatus(workOrder) }))
    const requisitions = applyFilters(data.requisitions, filters)
    const technicianPerformance = data.technicians.map((technician) => {
      const assigned = workOrders.filter((workOrder) => workOrder.technicianId === technician.id)
      const completed = assigned.filter((workOrder) => workOrder.status === 'Completed').length
      return { id: technician.id, name: technician.fullName, assigned: assigned.length, completed, open: assigned.length - completed }
    })

    return {
      workOrderSummary: {
        total: workOrders.length,
        completed: workOrders.filter((workOrder) => workOrder.status === 'Completed').length,
        open: workOrders.filter((workOrder) => !['Completed', 'Cancelled'].includes(workOrder.status)).length,
      },
      slaPerformance: {
        onTrack: workOrders.filter((workOrder) => workOrder.slaStatus === 'On Track').length,
        atRisk: workOrders.filter((workOrder) => workOrder.slaStatus === 'At Risk').length,
        breached: workOrders.filter((workOrder) => workOrder.slaStatus === 'Breached').length,
      },
      technicianPerformance,
      materialsUsed: requisitions.filter((requisition) => requisition.status === 'Issued'),
      acknowledgements: workOrders.filter((workOrder) => workOrder.clientAcknowledgement),
      workOrders,
    }
  },
}
