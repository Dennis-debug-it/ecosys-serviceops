import type { ReactElement } from 'react'
import {
  Bell,
  Boxes,
  Building2,
  FileDigit,
  History,
  KeyRound,
  Mail,
  MonitorCog,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { SettingsBranchesPage } from '../../modules/settings/BranchesPage'
import {
  LiveNotificationsSettingsPage,
  LiveSecuritySettingsPage,
} from '../../modules/settings/AdvancedSettingsPages'
import {
  EmailNotificationsSettingsPage,
  EmailTemplatesSettingsPage,
  MonitoringToolIntakeSettingsPage,
  NumberingRulesAdminPage,
} from '../../modules/settings/AdminSettingsPages'
import { AssetCategoriesSettingsPage } from '../../modules/settings/AssetCategoriesSettingsPage'
import { IntakeProtocolsPage } from '../../modules/settings/intake/IntakeProtocolsPage'
import { SettingsUsersPage } from '../../modules/settings/UsersPage'
import { SLAManagementPage } from '../../modules/sla/SLAManagementPage'
import {
  AuditLogsSettingsPage,
  CompanyProfileSettingsPage,
} from './SettingsDetailPages'

export type SettingsSection = {
  label: string
  shortLabel: string
  description: string
  segment: string
  path: string
  icon: LucideIcon
}

export type SettingsRouteDefinition = {
  path: string
  element: ReactElement
}

function section(
  segment: string,
  label: string,
  shortLabel: string,
  description: string,
  icon: LucideIcon,
): SettingsSection {
  return {
    label,
    shortLabel,
    description,
    segment,
    path: `/settings/${segment}`,
    icon,
  }
}

export const settingsSections: SettingsSection[] = [
  section('company-profile', 'Company Profile', 'Profile', 'Legal, company, and tenant identity details.', Building2),
  section('users', 'Users & Roles', 'Users', 'User accounts, roles, and tenant permission controls.', Users),
  section('assignment-groups', 'Assignment Groups', 'Groups', 'Dispatch groups, members, and routing defaults.', Users),
  section('branches', 'Branches / Outlets', 'Branches', 'Branch structure, outlet details, and activation.', Workflow),
  section('asset-categories', 'Asset Categories', 'Categories', 'Define asset categories and custom field schemas.', Boxes),
  section('sla-plans', 'SLA Plans', 'SLA', 'Configure response and resolution targets by priority.', Workflow),
  section('numbering-rules', 'Numbering Rules', 'Numbers', 'Prefixes, counters, and document numbering behavior.', FileDigit),
  section('email-notifications', 'Email Notifications', 'Email', 'SMTP and outbound notification sender settings.', Mail),
  section('email-templates', 'Email Templates', 'Templates', 'Edit tenant override templates for invites, onboarding, and operational emails.', Mail),
  section('email-intake', 'Email Intake', 'Email', 'Build intake protocols for automated work order generation from email and monitoring sources.', Mail),
  section('monitoring-intake', 'Monitoring Tool Intake', 'Monitor', 'Webhook intake and automated monitoring work creation.', MonitorCog),
  section('notifications', 'Notifications', 'Alerts', 'Tenant notifications, alerts, and digest preferences.', Bell),
  section('password-rules', 'Password Rules', 'Security', 'Password, MFA, and session security policies.', KeyRound),
  section('audit-logs', 'Audit Logs', 'Audit', 'Configuration history and tenant change tracking.', History),
]

export const defaultSettingsSegment = settingsSections[0].segment

export const settingsPageRoutes: SettingsRouteDefinition[] = [
  { path: 'company-profile', element: <CompanyProfileSettingsPage /> },
  { path: 'users', element: <SettingsUsersPage /> },
  { path: 'assignment-groups', element: <SettingsUsersPage /> },
  { path: 'branches', element: <SettingsBranchesPage /> },
  { path: 'asset-categories', element: <AssetCategoriesSettingsPage /> },
  { path: 'sla-plans', element: <SLAManagementPage /> },
  { path: 'numbering-rules', element: <NumberingRulesAdminPage /> },
  { path: 'email-notifications', element: <EmailNotificationsSettingsPage /> },
  { path: 'email-templates', element: <EmailTemplatesSettingsPage /> },
  { path: 'email-intake', element: <IntakeProtocolsPage /> },
  { path: 'monitoring-intake', element: <MonitoringToolIntakeSettingsPage /> },
  { path: 'notifications', element: <LiveNotificationsSettingsPage /> },
  { path: 'password-rules', element: <LiveSecuritySettingsPage /> },
  { path: 'audit-logs', element: <AuditLogsSettingsPage /> },
]

export const settingsLegacyRedirects: Array<{ from: string; to: string }> = [
  { from: 'branding', to: 'company-profile' },
  { from: 'users-groups', to: 'users' },
  { from: 'users-roles', to: 'users' },
  { from: 'roles-permissions', to: 'users' },
  { from: 'permissions', to: 'users' },
  { from: 'branches-outlets', to: 'branches' },
  { from: 'sla-contracts', to: 'sla-plans' },
  { from: 'email-settings', to: 'email-notifications' },
  { from: 'monitoring-tool-intake', to: 'monitoring-intake' },
  { from: 'security', to: 'password-rules' },
  { from: 'data-import', to: 'audit-logs' },
]
