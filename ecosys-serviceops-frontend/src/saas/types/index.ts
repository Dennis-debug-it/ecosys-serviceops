export type ThemeMode = 'dark' | 'light'

export type TimeRange = 'Today' | 'Week' | 'Month'

export type WorkOrderStatus = 'Open' | 'In Progress' | 'Completed' | 'Overdue' | 'SLA Breach' | 'Pending Parts'

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'

export type SlaState = 'On Track' | 'At Risk' | 'Breached'

export type AssetHealth = 'Operational' | 'Degraded' | 'Maintenance Due' | 'Offline'

export type PmStatus = 'Scheduled' | 'Due Today' | 'Overdue' | 'Completed'

export type MaterialState = 'Healthy' | 'Low Stock' | 'Reserved' | 'Out of Stock'

export type UserRole = 'Superadmin' | 'Tenant Admin' | 'Service Manager' | 'Dispatcher' | 'Technician'

export type TenantStatus = 'Healthy' | 'Near Limit' | 'Attention'

export type TrendDirection = 'up' | 'down' | 'flat'

export type NavItem = {
  label: string
  href: string
  icon: string
  section: 'Main' | 'Operations' | 'Settings'
  badge?: string
  badgeTone?: 'default' | 'warning'
}

export type BreadcrumbItem = {
  label: string
  href?: string
}

export type Tenant = {
  id: string
  name: string
  branch: string
  status: TenantStatus
}

export type DashboardStat = {
  id: string
  label: string
  value: string
  tone: 'open' | 'overdue' | 'done' | 'pending'
  trendLabel: string
  trendDirection: TrendDirection
}

export type TrendPoint = {
  day: string
  value: number
}

export type SlaMetric = {
  id: string
  label: string
  value: number
  tone: 'primary' | 'emerald' | 'amber' | 'rose'
  target: string
}

export type Person = {
  name: string
  initials: string
}

export type TimelineStep = {
  id: string
  label: string
  time: string
  status: 'done' | 'active' | 'upcoming'
}

export type WorkOrder = {
  id: string
  number: string
  title: string
  client: string
  site: string
  asset: string
  status: WorkOrderStatus
  technician: Person
  priority: Priority
  slaState: SlaState
  slaLabel: string
  branch: string
  createdAt: string
  scheduledAt: string
  description: string
  costImpact: string
  category: string
  notes: string[]
  materialsRequested: string[]
  timeline: TimelineStep[]
}

export type Asset = {
  id: string
  code: string
  name: string
  site: string
  client: string
  health: AssetHealth
  category: string
  nextPm: string
  uptime: string
  branch: string
}

export type PreventiveTask = {
  id: string
  asset: string
  branch: string
  dueDate: string
  frequency: string
  assignee: Person
  status: PmStatus
}

export type MaterialItem = {
  id: string
  name: string
  sku: string
  branch: string
  stock: number
  reorderLevel: number
  reserved: number
  state: MaterialState
}

export type ClientSla = {
  id: string
  client: string
  branch: string
  sites: number
  slaTier: string
  responseTarget: string
  resolutionTarget: string
  activeIncidents: number
}

export type UserRecord = {
  id: string
  name: string
  initials: string
  role: UserRole
  branch: string
  status: 'Active' | 'Suspended'
  lastSeen: string
}

export type BranchRecord = {
  id: string
  name: string
  region: string
  technicians: number
  openWorkOrders: number
  assets: number
  slaScore: number
}

export type ReportSummary = {
  id: string
  title: string
  metric: string
  trend: string
  detail: string
}

export type CommandCentreMetric = {
  id: string
  label: string
  value: string
  detail: string
}

export type CommandCentreHealth = {
  id: string
  label: string
  status: 'Healthy' | 'Warning' | 'Critical'
  detail: string
}

export type Notification = {
  id: string
  title: string
  detail: string
  tone: 'info' | 'warning' | 'critical'
}

export type ModalState =
  | { type: 'none' }
  | {
      type: 'newWorkOrder'
      title: string
      description: string
    }

export type ServiceOpsData = {
  tenant: Tenant
  stats: DashboardStat[]
  trendPoints: TrendPoint[]
  slaMetrics: SlaMetric[]
  workOrders: WorkOrder[]
  assets: Asset[]
  preventiveTasks: PreventiveTask[]
  materials: MaterialItem[]
  clientSlas: ClientSla[]
  users: UserRecord[]
  branches: BranchRecord[]
  reports: ReportSummary[]
  commandCentreMetrics: CommandCentreMetric[]
  commandCentreHealth: CommandCentreHealth[]
  notifications: Notification[]
}
