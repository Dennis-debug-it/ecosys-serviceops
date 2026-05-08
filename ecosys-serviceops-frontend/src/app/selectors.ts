import { deriveSlaStatus, formatRelativeCountdown } from '../utils/date'
import type {
  AppDatabase,
  AssetRecord,
  InventoryItem,
  Role,
  SearchItem,
  TenantData,
  TechnicianRecord,
  WorkOrderRecord,
} from '../types/app'

export type WorkOrderView = WorkOrderRecord & {
  assetName: string
  clientName: string
  siteName: string
  technicianGroupName: string
  technicianName: string
  slaCountdown: string
  slaStatus: WorkOrderRecord['slaStatus']
}

export type DashboardMetrics = {
  openWorkOrders: number
  slaRisk: number
  activeTechnicians: number
  materialsPending: number
  slaWatchlist: WorkOrderView[]
  priorityWorkOrders: WorkOrderView[]
  materialsIssues: InventoryItem[]
}

const tenantRoles: Role[] = ['admin', 'user']
const platformRoles: Role[] = ['superadmin']

function getSiteRecord(data: TenantData, siteId?: string) {
  if (!siteId) return undefined
  return data.clients.flatMap((client) => client.sites).find((site) => site.id === siteId)
}

function getTechnicianRecord(data: TenantData, technicianId?: string) {
  if (!technicianId) return undefined
  return data.technicians.find((technician) => technician.id === technicianId)
}

function getTechnicianGroupRecord(data: TenantData, groupId?: string) {
  if (!groupId) return undefined
  return data.settings.technicianGroups.find((group) => group.id === groupId)
}

function getAssetRecord(data: TenantData, assetId?: string) {
  if (!assetId) return undefined
  return data.assets.find((asset) => asset.id === assetId)
}

export function getClientName(data: TenantData | undefined, clientId?: string) {
  if (!data || !clientId) return 'Unknown client'
  return data.clients.find((client) => client.id === clientId)?.name ?? 'Unknown client'
}

export function getSiteName(data: TenantData | undefined, siteId?: string) {
  if (!data || !siteId) return 'Unknown site'
  return getSiteRecord(data, siteId)?.name ?? 'Unknown site'
}

export function getAssetName(data: TenantData | undefined, assetId?: string) {
  if (!data || !assetId) return 'Unlinked asset'
  return getAssetRecord(data, assetId)?.name ?? 'Unlinked asset'
}

export function getTechnicianName(data: TenantData | undefined, technicianId?: string) {
  if (!data || !technicianId) return 'Unassigned'
  return getTechnicianRecord(data, technicianId)?.fullName ?? 'Unassigned'
}

export function getTechnicianGroupName(data: TenantData | undefined, groupId?: string) {
  if (!data || !groupId) return 'No group'
  return getTechnicianGroupRecord(data, groupId)?.name ?? 'No group'
}

export function toWorkOrderView(data: TenantData, workOrder: WorkOrderRecord): WorkOrderView {
  const liveSlaStatus = deriveSlaStatus(workOrder)

  return {
    ...workOrder,
    assetName: getAssetName(data, workOrder.assetId),
    clientName: getClientName(data, workOrder.clientId),
    siteName: getSiteName(data, workOrder.siteId),
    technicianGroupName: getTechnicianGroupName(data, workOrder.technicianGroupId),
    technicianName: getTechnicianName(data, workOrder.technicianId),
    slaCountdown: formatRelativeCountdown(workOrder.resolutionDueAt),
    slaStatus: liveSlaStatus,
  }
}

function sortByDueDate(left: WorkOrderView, right: WorkOrderView) {
  return left.resolutionDueAt.localeCompare(right.resolutionDueAt)
}

function priorityRank(priority: WorkOrderRecord['priority']) {
  if (priority === 'Critical') return 4
  if (priority === 'High') return 3
  if (priority === 'Medium') return 2
  return 1
}

function buildTenantRouteItems(): SearchItem[] {
  return [
    { id: 'route-dashboard', title: 'Dashboard', subtitle: 'Operational snapshot', path: '/dashboard', roles: tenantRoles },
    { id: 'route-work-orders', title: 'Work Orders', subtitle: 'Dispatch and status tracking', path: '/work-orders', roles: tenantRoles },
    { id: 'route-assets', title: 'Assets', subtitle: 'Asset register and PM actions', path: '/assets', roles: tenantRoles },
    { id: 'route-field-operations', title: 'Field Operations', subtitle: 'Technician roster and workload', path: '/field-operations', roles: tenantRoles },
    { id: 'route-inventory', title: 'Inventory', subtitle: 'Stores and requisitions', path: '/inventory', roles: tenantRoles },
    { id: 'route-clients', title: 'Clients', subtitle: 'Client profiles and sites', path: '/clients', roles: tenantRoles },
    { id: 'route-sla', title: 'SLA Management', subtitle: 'Rules, mappings, and watchlists', path: '/sla', roles: tenantRoles },
    { id: 'route-reports', title: 'Reports', subtitle: 'Service and performance reporting', path: '/reports', roles: tenantRoles },
    { id: 'route-settings', title: 'Settings', subtitle: 'Admin-only tenant configuration', path: '/settings', roles: ['admin'] },
  ]
}

export function buildSearchItems(database: AppDatabase, tenantId?: string): SearchItem[] {
  if (!tenantId) {
    return [
      { id: 'platform-command-centre', title: 'Command Centre', subtitle: 'Platform-wide operations view', path: '/dashboard', roles: platformRoles },
      ...database.tenants.slice(0, 8).map((tenant) => ({
        id: `tenant-${tenant.id}`,
        title: tenant.name,
        subtitle: `${tenant.code} • ${tenant.subscriptionStatus}`,
        path: '/dashboard',
        roles: platformRoles,
      })),
    ]
  }

  const data = database.tenantData[tenantId]
  if (!data) return buildTenantRouteItems()

  const workOrders = data.workOrders.slice(0, 8).map((workOrder) => ({
    id: `search-work-order-${workOrder.id}`,
    title: workOrder.workOrderNumber,
    subtitle: `${workOrder.title} • ${getClientName(data, workOrder.clientId)}`,
    path: `/work-orders/${workOrder.id}`,
    roles: tenantRoles,
  }))

  const assets = data.assets.slice(0, 8).map((asset: AssetRecord) => ({
    id: `search-asset-${asset.id}`,
    title: asset.name,
    subtitle: `${asset.assetCode} • ${getClientName(data, asset.clientId)}`,
    path: '/assets',
    roles: tenantRoles,
  }))

  const technicians = data.technicians.slice(0, 8).map((technician: TechnicianRecord) => ({
    id: `search-technician-${technician.id}`,
    title: technician.fullName,
    subtitle: `${getTechnicianGroupName(data, technician.groupId)} • ${technician.status}`,
    path: '/field-operations',
    roles: tenantRoles,
  }))

  const clients = data.clients.slice(0, 8).map((client) => ({
    id: `search-client-${client.id}`,
    title: client.name,
    subtitle: `${client.sites.length} sites • ${client.emailIntegrationStatus}`,
    path: '/clients',
    roles: tenantRoles,
  }))

  return [...buildTenantRouteItems(), ...workOrders, ...assets, ...technicians, ...clients]
}

export function getDashboardMetrics(data: TenantData | undefined): DashboardMetrics {
  if (!data) {
    return {
      openWorkOrders: 0,
      slaRisk: 0,
      activeTechnicians: 0,
      materialsPending: 0,
      slaWatchlist: [],
      priorityWorkOrders: [],
      materialsIssues: [],
    }
  }

  const workOrders = data.workOrders.map((workOrder) => toWorkOrderView(data, workOrder))
  const openWorkOrders = workOrders.filter((workOrder) => !['Completed', 'Cancelled'].includes(workOrder.status))
  const materialsIssues = data.inventoryItems
    .filter((item) => item.quantity <= item.reorderLevel)
    .sort((left, right) => left.quantity - right.quantity)

  return {
    openWorkOrders: openWorkOrders.length,
    slaRisk: openWorkOrders.filter((workOrder) => workOrder.slaStatus !== 'On Track').length,
    activeTechnicians: data.technicians.filter((technician) => technician.status !== 'Offline').length,
    materialsPending: data.requisitions.filter((requisition) => ['Pending', 'Approved'].includes(requisition.status)).length,
    slaWatchlist: [...openWorkOrders].sort(sortByDueDate),
    priorityWorkOrders: [...openWorkOrders]
      .filter((workOrder) => workOrder.priority === 'Critical' || workOrder.priority === 'High')
      .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority) || sortByDueDate(left, right)),
    materialsIssues,
  }
}
