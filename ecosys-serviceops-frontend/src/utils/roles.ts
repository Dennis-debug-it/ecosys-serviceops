import type { ApiRole } from '../types/api'
import type { KnownRole, Role } from '../types/app'
import type { PlatformRole } from '../types/platform'

export type CanonicalPlatformRole = 'PlatformOwner' | 'PlatformAdmin' | 'SupportAdmin'

export const PLATFORM_ROLE_OPTIONS: Array<{
  value: CanonicalPlatformRole
  label: string
  description: string
}> = [
  {
    value: 'PlatformOwner',
    label: 'Platform Owner',
    description: 'Highest authority for platform settings, tenants, platform users, licenses, branding, templates, audit logs, and global configuration.',
  },
  {
    value: 'PlatformAdmin',
    label: 'Platform Admin',
    description: 'Operational administrator for onboarding, workspace requests, tenants, support actions, reports, and selected platform settings.',
  },
  {
    value: 'SupportAdmin',
    label: 'Support Admin',
    description: 'Support/helpdesk role for onboarding assistance, user access troubleshooting, system health checks, and credential resends.',
  },
]

const PLATFORM_ROLE_KEYS = new Set<KnownRole>(['superadmin', 'platformsuperadmin', 'platformowner', 'platformadmin', 'supportadmin'])

export function normalizeAppRole(role: string): ApiRole {
  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!normalized) return 'user'

  if (normalized === 'superadmin') return 'superadmin'
  if (normalized === 'platformsuperadmin') return 'platformsuperadmin'
  if (normalized === 'platformowner') return 'platformowner'
  if (normalized === 'platformadmin') return 'platformadmin'
  if (normalized === 'supportadmin' || normalized === 'support') return 'supportadmin'
  if (normalized === 'tenantadmin') return 'tenantadmin'
  if (normalized === 'admin') return 'admin'
  if (normalized === 'technician') return 'technician'

  return normalized as ApiRole
}

export function isPlatformRole(role: Role) {
  return PLATFORM_ROLE_KEYS.has(normalizeAppRole(String(role)) as KnownRole)
}

export function roleHomePath(role: Role) {
  return isPlatformRole(role) ? '/platform' : '/dashboard'
}

export function normalizePlatformRole(role: string): CanonicalPlatformRole {
  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, '')

  if (normalized === 'platformowner' || normalized === 'superadmin' || normalized === 'platformsuperadmin') {
    return 'PlatformOwner'
  }

  if (normalized === 'supportadmin' || normalized === 'support') {
    return 'SupportAdmin'
  }

  return 'PlatformAdmin'
}

export function getPlatformRoleLabel(role: string | PlatformRole) {
  const normalized = normalizePlatformRole(String(role))
  return PLATFORM_ROLE_OPTIONS.find((item) => item.value === normalized)?.label ?? 'Platform Admin'
}

export function getPlatformRoleDescription(role: string | PlatformRole) {
  const normalized = normalizePlatformRole(String(role))
  return PLATFORM_ROLE_OPTIONS.find((item) => item.value === normalized)?.description
    ?? 'Operational administrator for platform onboarding, tenant management, and support workflows.'
}
