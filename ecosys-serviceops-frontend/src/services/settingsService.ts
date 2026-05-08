import { api } from '../lib/api'
import type {
  AssignmentGroupRecord,
  EmailIntakeSettings,
  EmailNotificationSettings,
  IntakeProtocolRecord,
  IntakeProtocolTestResponse,
  MonitoringWebhookIntegrationRecord,
  MonitoringSettings,
  NumberingRuleRecord,
  NotificationSettings,
  TenantSecuritySettings,
  UpsertIntakeProtocolInput,
  UpdateEmailIntakeSettingsInput,
  UpdateEmailNotificationSettingsInput,
  UpdateNumberingRuleInput,
  UpsertMonitoringWebhookIntegrationInput,
  UpsertAssignmentGroupInput,
} from '../types/api'
import { asArray } from '../utils/apiDefaults'

export const settingsService = {
  async listAssignmentGroups(signal?: AbortSignal): Promise<AssignmentGroupRecord[]> {
    const response = await api.get<unknown>('/api/assignment-groups', { signal })
    return asArray<AssignmentGroupRecord>(response).map((group) => ({
      ...group,
      members: group.members ?? [],
      technicianIds: group.members?.map((member) => member.technicianId) ?? group.technicianIds ?? [],
    }))
  },
  getAssignmentGroup(id: string, signal?: AbortSignal) {
    return api.get<AssignmentGroupRecord>(`/api/assignment-groups/${id}`, { signal })
  },
  createAssignmentGroup(input: UpsertAssignmentGroupInput) {
    return api.post<AssignmentGroupRecord>('/api/assignment-groups', {
      ...input,
      members: input.members?.length ? input.members : (input.technicianIds ?? []).map((technicianId) => ({ technicianId, isLead: false })),
    })
  },
  updateAssignmentGroup(id: string, input: UpsertAssignmentGroupInput) {
    return api.put<AssignmentGroupRecord>(`/api/assignment-groups/${id}`, {
      ...input,
      members: input.members?.length ? input.members : (input.technicianIds ?? []).map((technicianId) => ({ technicianId, isLead: false })),
    })
  },
  deleteAssignmentGroup(id: string) {
    return api.delete<void>(`/api/assignment-groups/${id}`)
  },
  getAssignmentGroupMembers(id: string, signal?: AbortSignal) {
    return api.get<AssignmentGroupRecord['members']>(`/api/assignment-groups/${id}/members`, { signal })
  },
  addAssignmentGroupMember(id: string, input: { userId?: string | null; technicianId?: string | null; isLead: boolean }) {
    return api.post<AssignmentGroupRecord['members'][number]>(`/api/assignment-groups/${id}/members`, input)
  },
  removeAssignmentGroupMember(id: string, userId: string) {
    return api.delete<void>(`/api/assignment-groups/${id}/members/${userId}`)
  },
  getSecurity(signal?: AbortSignal) {
    return api.get<TenantSecuritySettings>('/api/settings/security', { signal })
  },
  updateSecurity(input: TenantSecuritySettings) {
    return api.put<TenantSecuritySettings>('/api/settings/security', input)
  },
  getNotifications(signal?: AbortSignal) {
    return api.get<NotificationSettings>('/api/settings/notifications', { signal })
  },
  updateNotifications(input: NotificationSettings) {
    return api.put<NotificationSettings>('/api/settings/notifications', input)
  },
  getEmailNotifications(signal?: AbortSignal) {
    return api.get<EmailNotificationSettings>('/api/settings/email-notifications', { signal })
  },
  updateEmailNotifications(input: UpdateEmailNotificationSettingsInput) {
    return api.put<EmailNotificationSettings>('/api/settings/email-notifications', input)
  },
  testEmailNotifications(testRecipientEmail: string) {
    return api.post<{ success: boolean; lastTestedAt?: string | null; lastError?: string | null }>('/api/settings/email-notifications/test', { testRecipientEmail })
  },
  getEmailIntake(signal?: AbortSignal) {
    return api.get<EmailIntakeSettings>('/api/settings/email-intake', { signal })
  },
  updateEmailIntake(input: UpdateEmailIntakeSettingsInput) {
    return api.put<EmailIntakeSettings>('/api/settings/email-intake', input)
  },
  testEmailIntakeConnection(host: string, port: number) {
    return api.post<{ success: boolean; lastCheckedAt?: string | null; lastError?: string | null }>('/api/settings/email-intake/test-connection', { host, port })
  },
  async listIntakeProtocols(signal?: AbortSignal): Promise<IntakeProtocolRecord[]> {
    const response = await api.get<unknown>('/api/settings/intake-protocols', { signal })
    return asArray<IntakeProtocolRecord>(response)
  },
  getIntakeProtocol(id: string, signal?: AbortSignal) {
    return api.get<IntakeProtocolRecord>(`/api/settings/intake-protocols/${id}`, { signal })
  },
  createIntakeProtocol(input: UpsertIntakeProtocolInput) {
    return api.post<IntakeProtocolRecord>('/api/settings/intake-protocols', input)
  },
  updateIntakeProtocol(id: string, input: UpsertIntakeProtocolInput) {
    return api.put<IntakeProtocolRecord>(`/api/settings/intake-protocols/${id}`, input)
  },
  deleteIntakeProtocol(id: string) {
    return api.delete<void>(`/api/settings/intake-protocols/${id}`)
  },
  testIntakeProtocol(id: string) {
    return api.post<IntakeProtocolTestResponse>(`/api/settings/intake-protocols/${id}/test`, {})
  },
  getMonitoring(signal?: AbortSignal) {
    return api.get<MonitoringSettings>('/api/settings/monitoring', { signal })
  },
  updateMonitoring(input: MonitoringSettings) {
    return api.put<MonitoringSettings>('/api/settings/monitoring', input)
  },
  async listMonitoringWebhooks(signal?: AbortSignal): Promise<MonitoringWebhookIntegrationRecord[]> {
    const response = await api.get<unknown>('/api/settings/monitoring-webhooks', { signal })
    return asArray<MonitoringWebhookIntegrationRecord>(response)
  },
  getMonitoringWebhook(id: string, signal?: AbortSignal) {
    return api.get<MonitoringWebhookIntegrationRecord>(`/api/settings/monitoring-webhooks/${id}`, { signal })
  },
  createMonitoringWebhook(input: UpsertMonitoringWebhookIntegrationInput) {
    return api.post<MonitoringWebhookIntegrationRecord>('/api/settings/monitoring-webhooks', input)
  },
  updateMonitoringWebhook(id: string, input: UpsertMonitoringWebhookIntegrationInput) {
    return api.put<MonitoringWebhookIntegrationRecord>(`/api/settings/monitoring-webhooks/${id}`, input)
  },
  deleteMonitoringWebhook(id: string) {
    return api.delete<void>(`/api/settings/monitoring-webhooks/${id}`)
  },
  rotateMonitoringWebhookSecret(id: string) {
    return api.post<MonitoringWebhookIntegrationRecord>(`/api/settings/monitoring-webhooks/${id}/rotate-secret`, {})
  },
  testMonitoringWebhook(id: string) {
    return api.post<{ success: boolean; lastReceivedAt?: string | null; lastStatus?: string | null; lastError?: string | null }>(`/api/settings/monitoring-webhooks/${id}/test`, {})
  },
  async listNumberingRules(signal?: AbortSignal): Promise<NumberingRuleRecord[]> {
    const response = await api.get<unknown>('/api/settings/numbering-rules', { signal })
    return asArray<NumberingRuleRecord>(response)
  },
  updateNumberingRule(id: string, input: UpdateNumberingRuleInput) {
    return api.put<NumberingRuleRecord>(`/api/settings/numbering-rules/${id}`, input)
  },
  async seedDefaultNumberingRules() {
    const response = await api.post<unknown>('/api/settings/numbering-rules/seed-defaults', {})
    return asArray<NumberingRuleRecord>(response)
  },
  previewNumberingRule(ruleId?: string, documentType?: string) {
    return api.post<{ ruleId: string; documentType: string; preview: string }>('/api/settings/numbering-rules/preview', { ruleId, documentType })
  },
}
