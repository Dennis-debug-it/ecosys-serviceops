import type { PlatformSettingsSection } from '../../../../services/platformSettingsService'

export type SettingsNavSection = {
  id: PlatformSettingsSection
  label: string
  description: string
}

export const settingsSections: SettingsNavSection[] = [
  { id: 'general', label: 'General', description: 'Platform identity and defaults.' },
  { id: 'branding', label: 'Branding', description: 'Visual identity and logo controls.' },
  { id: 'email', label: 'Email & Notifications', description: 'SMTP setup and operational alert preferences.' },
  { id: 'numbering', label: 'Numbering', description: 'Prefixes, counters, and generated previews.' },
  { id: 'security', label: 'Security', description: 'Password and session policies.' },
  { id: 'system-preferences', label: 'System Preferences', description: 'Date/time, pagination, and platform toggles.' },
]
