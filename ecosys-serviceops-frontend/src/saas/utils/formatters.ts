import type {
  BreadcrumbItem,
  MaterialState,
  PmStatus,
  Priority,
  SlaState,
  TenantStatus,
  ThemeMode,
  TrendDirection,
  WorkOrderStatus,
} from '../types'

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) {
    return [
      { label: 'Home', href: '/' },
      { label: 'Dashboard' },
    ]
  }

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    'work-orders': 'Work Orders',
    assets: 'Assets',
    'preventive-maintenance': 'Preventive Maintenance',
    'stores-materials': 'Stores & Materials',
    'clients-sla': 'Clients & SLA',
    'users-roles': 'Users & Roles',
    'branch-management': 'Branch Management',
    reports: 'Reports',
  }

  return [
    { label: 'Home', href: '/dashboard' },
    ...parts.map((part, index) => ({
      label: labels[part] ?? part.toUpperCase(),
      href: index < parts.length - 1 ? `/${parts.slice(0, index + 1).join('/')}` : undefined,
    })),
  ]
}

export function trendSymbol(direction: TrendDirection) {
  if (direction === 'up') return '+'
  if (direction === 'down') return '-'
  return 'o'
}

export function statusBadgeTone(
  status: WorkOrderStatus | SlaState | MaterialState | PmStatus | TenantStatus | 'Active' | 'Suspended',
) {
  const toneMap: Record<string, 'open' | 'progress' | 'done' | 'overdue' | 'breach' | 'pending'> = {
    Open: 'open',
    'In Progress': 'progress',
    Completed: 'done',
    Overdue: 'overdue',
    'SLA Breach': 'breach',
    'Pending Parts': 'pending',
    'On Track': 'done',
    'At Risk': 'progress',
    Breached: 'breach',
    Healthy: 'done',
    'Low Stock': 'progress',
    Reserved: 'pending',
    'Out of Stock': 'breach',
    Scheduled: 'open',
    'Due Today': 'progress',
    Active: 'done',
    Suspended: 'overdue',
    'Near Limit': 'progress',
    Attention: 'overdue',
  }

  return toneMap[status] ?? 'open'
}

export function priorityTone(priority: Priority) {
  if (priority === 'Critical') return 'breach'
  if (priority === 'High') return 'progress'
  if (priority === 'Medium') return 'open'
  return 'done'
}

export function themeLabel(theme: ThemeMode) {
  return theme === 'dark' ? 'Light mode' : 'Dark mode'
}
