import { serviceOpsData } from '@/saas/mock/data'
import type { Asset, BranchRecord, ClientSla, CommandCentreHealth, CommandCentreMetric, DashboardStat, MaterialItem, PreventiveTask, ReportSummary, SlaMetric, Tenant, TrendPoint, UserRecord, WorkOrder } from '@/saas/types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const apiClient = {
  async getTenant(): Promise<Tenant> {
    await wait(120)
    return serviceOpsData.tenant
  },
  async getDashboardStats(): Promise<DashboardStat[]> {
    await wait(120)
    return serviceOpsData.stats
  },
  async getTrendPoints(): Promise<TrendPoint[]> {
    await wait(120)
    return serviceOpsData.trendPoints
  },
  async getSlaMetrics(): Promise<SlaMetric[]> {
    await wait(120)
    return serviceOpsData.slaMetrics
  },
  async listWorkOrders(): Promise<WorkOrder[]> {
    await wait(120)
    return serviceOpsData.workOrders
  },
  async getWorkOrderById(id: string): Promise<WorkOrder | undefined> {
    await wait(80)
    return serviceOpsData.workOrders.find((workOrder) => workOrder.id === id)
  },
  async listAssets(): Promise<Asset[]> {
    await wait(120)
    return serviceOpsData.assets
  },
  async listPreventiveTasks(): Promise<PreventiveTask[]> {
    await wait(120)
    return serviceOpsData.preventiveTasks
  },
  async listMaterials(): Promise<MaterialItem[]> {
    await wait(120)
    return serviceOpsData.materials
  },
  async listClientSlas(): Promise<ClientSla[]> {
    await wait(120)
    return serviceOpsData.clientSlas
  },
  async listUsers(): Promise<UserRecord[]> {
    await wait(120)
    return serviceOpsData.users
  },
  async listBranches(): Promise<BranchRecord[]> {
    await wait(120)
    return serviceOpsData.branches
  },
  async listReports(): Promise<ReportSummary[]> {
    await wait(120)
    return serviceOpsData.reports
  },
  async getCommandCentreMetrics(): Promise<CommandCentreMetric[]> {
    await wait(120)
    return serviceOpsData.commandCentreMetrics
  },
  async getCommandCentreHealth(): Promise<CommandCentreHealth[]> {
    await wait(120)
    return serviceOpsData.commandCentreHealth
  },
}
