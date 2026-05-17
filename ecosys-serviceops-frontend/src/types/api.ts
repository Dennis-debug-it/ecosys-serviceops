export type ApiRole =
  | 'superadmin'
  | 'platformsuperadmin'
  | 'platformadmin'
  | 'platformowner'
  | 'supportadmin'
  | 'tenantadmin'
  | 'admin'
  | 'technician'
  | 'user'
  | (string & {})

export interface ApiPermissions {
  canViewWorkOrders: boolean
  canCreateWorkOrders: boolean
  canAssignWorkOrders: boolean
  canCompleteWorkOrders: boolean
  canApproveMaterials: boolean
  canIssueMaterials: boolean
  canManageAssets: boolean
  canManageSettings: boolean
  canViewReports: boolean
  canViewPlatformTenants?: boolean
  canCreatePlatformTenants?: boolean
  canEditPlatformTenants?: boolean
  canUpdatePlatformTenantStatus?: boolean
  canDeactivatePlatformTenants?: boolean
}

export interface ApiBranch {
  id: string
  name: string
  code: string
  location?: string | null
  isActive: boolean
}

export interface ApiTenantContext {
  tenantId: string
  companyName: string
  country: string
  industry?: string | null
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
  showPoweredByEcosys?: boolean
}

export interface ApiUserContext {
  userId: string
  fullName: string
  email: string
  role: string
  jobTitle?: string | null
  department?: string | null
  hasAllBranchAccess?: boolean
  defaultBranchId?: string | null
  mustChangePassword?: boolean
  permissions: ApiPermissions
}

export interface LoginResponse {
  token: string
  user?: ApiUserContext
  tenant?: ApiTenantContext
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface SignupResponse {
  token: string
  tenantId: string
  userId: string
  companyName: string
  role: string
  jobTitle?: string | null
  permissions: ApiPermissions
}

export interface MeResponse {
  user: ApiUserContext
  tenant: ApiTenantContext
  branches: ApiBranch[]
}

export interface DashboardSummary {
  openWorkOrders: number
  closedWorkOrders: number
  overdueWorkOrders: number
  assets: number
  clients: number
  materialsLowStock: number
  unassignedWorkOrders: number
  assignedToGroup: number
  assignedToTechnicians: number
  awaitingAcceptance: number
  techniciansOnSite: number
  workOrdersByGroup: Array<{
    groupName: string
    count: number
  }>
  technicianWorkload: Array<{
    technicianName: string
    activeWorkOrders: number
    pendingResponses: number
    onSiteCount: number
  }>
}

export interface WorkOrderTechnicianAssignmentRecord {
  id: string
  technicianId: string
  technicianName?: string | null
  isLead: boolean
  status: string
  assignedAt: string
  acceptedAt?: string | null
  arrivalAt?: string | null
  departureAt?: string | null
  notes?: string | null
}

export interface WorkOrderAssignmentHistoryRecord {
  id: string
  action: string
  fromGroupId?: string | null
  fromGroupName?: string | null
  toGroupId?: string | null
  toGroupName?: string | null
  fromTechnicianId?: string | null
  fromTechnicianName?: string | null
  toTechnicianId?: string | null
  toTechnicianName?: string | null
  performedByUserId?: string | null
  performedByUserName?: string | null
  performedAt: string
  notes?: string | null
}

export interface WorkOrder {
  id: string
  branchId?: string | null
  branchName?: string | null
  clientId: string
  clientName?: string | null
  siteId?: string | null
  siteName?: string | null
  assetId?: string | null
  assetName?: string | null
  assignmentGroupId?: string | null
  assignmentGroupName?: string | null
  workOrderNumber: string
  title: string
  description?: string | null
  priority: string
  status: string
  slaStatus: string
  assignmentType: 'IndividualTechnician' | 'MultipleTechnicians' | 'AssignmentGroup' | 'Unassigned'
  assignedTechnicianId?: string | null
  assignedTechnicianName?: string | null
  assignedTechnicianIds: string[]
  leadTechnicianId?: string | null
  leadTechnicianName?: string | null
  assignmentStatus: string
  assignmentNotes?: string | null
  technicianAssignments?: WorkOrderTechnicianAssignmentRecord[] | null
  assignmentSummary?: string | null
  isUnassigned?: boolean
  dueDate?: string | null
  createdAt: string
  workStartedAt?: string | null
  arrivalAt?: string | null
  departureAt?: string | null
  completedAt?: string | null
  workDoneNotes?: string | null
  jobCardNotes?: string | null
  slaResponseDeadline?: string | null
  slaResolutionDeadline?: string | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  slaResponseBreachedAt?: string | null
  slaResolutionBreachedAt?: string | null
  acknowledgedByName?: string | null
  acknowledgementComments?: string | null
  acknowledgementDate?: string | null
  isPreventiveMaintenance: boolean
  pmTemplateId?: string | null
  pmTemplateName?: string | null
  preventiveMaintenancePlanId?: string | null
  checklistItems?: WorkOrderChecklistItemRecord[] | null
}

export interface WorkOrderExecutionNotes {
  findings?: string | null
  workDone?: string | null
}

export interface WorkOrderPhotoRecord {
  id: string
  attachmentId: string
  fileName: string
  publicUrl?: string | null
  caption: string
  category: string
  includeInReport: boolean
  uploadedByUserId: string
  uploadedByName?: string | null
  uploadedAt: string
}

export interface WorkOrderMaterialUsageRecord {
  id: string
  materialItemId: string
  materialName?: string | null
  unitOfMeasure?: string | null
  assetId?: string | null
  assetName?: string | null
  quantityUsed: number
  unitCost?: number | null
  chargeable: boolean
  notes?: string | null
  usedByUserId: string
  usedByName?: string | null
  usedAt: string
}

export interface WorkOrderSignatureRecord {
  id: string
  signatureType: 'Technician' | 'Client' | string
  signerName: string
  signerRole?: string | null
  signatureDataUrl: string
  comment?: string | null
  capturedByUserId: string
  capturedAt: string
}

export interface WorkOrderServiceReportPreview {
  companyName: string
  workOrderNumber: string
  title: string
  clientName?: string | null
  siteLabel?: string | null
  assetName?: string | null
  assetDetails?: string | null
  technicianTeam?: string | null
  reportedProblem?: string | null
  findings?: string | null
  workDone?: string | null
  generatedAtLabel: string
  timestamps: Array<{ label: string; value?: string | null }>
  materials: Array<{
    name: string
    quantityUsed: number
    unitOfMeasure: string
    unitCost?: number | null
    chargeable: boolean
    notes?: string | null
  }>
  photoGroups: Array<{
    category: string
    photos: Array<{
      caption: string
      publicUrl?: string | null
    }>
  }>
  signatures: Array<{
    signatureType: string
    signerName: string
    signerRole?: string | null
    comment?: string | null
    capturedAtLabel: string
  }>
  showPoweredByEcosys: boolean
}

export interface WorkOrderExecutionBundle {
  notes: WorkOrderExecutionNotes
  photos: WorkOrderPhotoRecord[]
  materialUsages: WorkOrderMaterialUsageRecord[]
  signatures: WorkOrderSignatureRecord[]
  reportPreview: WorkOrderServiceReportPreview
}

export interface CreateWorkOrderInput {
  clientId: string
  branchId?: string | null
  siteId?: string | null
  assetId?: string | null
  assignmentGroupId?: string | null
  assignmentType?: 'IndividualTechnician' | 'MultipleTechnicians' | 'AssignmentGroup' | 'Unassigned'
  assignedTechnicianId?: string | null
  assignedTechnicianIds?: string[]
  leadTechnicianId?: string | null
  assignmentNotes?: string | null
  title: string
  description?: string | null
  priority?: string | null
  dueDate?: string | null
  isPreventiveMaintenance: boolean
  pmTemplateId?: string | null
}

export interface UpdateWorkOrderInput extends CreateWorkOrderInput {
  status?: string | null
}

export interface ClientRecord {
  id: string
  clientName: string
  clientType?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  slaDefinitionId?: string | null
  slaDefinitionName?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
}

export interface UpsertClientInput {
  clientName: string
  clientType?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  slaDefinitionId?: string | null
  notes?: string | null
}

export interface SlaDefinitionRecord {
  id: string
  planName: string
  description?: string | null
  isActive: boolean
  rules: SlaRuleRecord[]
  createdAt: string
  updatedAt?: string | null
}

export interface SlaRuleRecord {
  id: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string
  responseTargetHours: number
  resolutionTargetHours: number
  businessHoursOnly: boolean
}

export interface UpsertSlaDefinitionInput {
  planName: string
  description?: string | null
  isActive: boolean
  rules: Array<{
    priority: 'Critical' | 'High' | 'Medium' | 'Low' | string
    responseTargetHours: number
    resolutionTargetHours: number
    businessHoursOnly: boolean
  }>
}

export interface KipContext {
  screen: string
  entityType?: string | null
  entityId?: string | null
  entitySummary?: Record<string, unknown> | null
  tenantId: string
  userId: string
  userRole: string
  timestamp: string
}

export interface KipQueryInput {
  context: KipContext
  message: string
}

export interface KipQueryResponse {
  response: string
}

export interface AssetRecord {
  id: string
  branchId?: string | null
  branchName?: string | null
  clientId: string
  clientName?: string | null
  siteId?: string | null
  siteName?: string | null
  assetCategoryId?: string | null
  assetCategoryName?: string | null
  assetName: string
  assetCode: string
  assetType?: string | null
  location?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  installationDate?: string | null
  warrantyExpiryDate?: string | null
  recommendedPmFrequency?: string | null
  autoSchedulePm: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  notes?: string | null
  status: string
  createdAt: string
  customFieldValues: AssetCustomFieldValueRecord[]
}

export interface UpsertAssetInput {
  clientId: string
  branchId?: string | null
  siteId?: string | null
  assetCategoryId?: string | null
  assetName: string
  assetCode?: string
  assetType?: string | null
  location?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  installationDate?: string | null
  warrantyExpiryDate?: string | null
  recommendedPmFrequency?: string | null
  autoSchedulePm: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  notes?: string | null
  status?: string | null
  customFieldValues?: UpsertAssetCustomFieldValueInput[]
}

export interface AssetCustomFieldValueRecord {
  fieldDefinitionId: string
  fieldName: string
  fieldLabel: string
  fieldType: string
  unit?: string | null
  value: string
}

export interface UpsertAssetCustomFieldValueInput {
  fieldDefinitionId: string
  value?: string | null
}

export interface MaterialItem {
  id: string
  branchId?: string | null
  branchName?: string | null
  itemCode: string
  itemName: string
  category?: string | null
  unitOfMeasure: string
  quantityOnHand: number
  reorderLevel: number
  unitCost?: number | null
  isActive: boolean
  isLowStock: boolean
  createdAt: string
}

export interface UpsertMaterialInput {
  itemCode: string
  itemName: string
  category?: string | null
  unitOfMeasure: string
  quantityOnHand: number
  reorderLevel: number
  unitCost?: number | null
  branchId?: string | null
}

export interface StockMovement {
  id: string
  branchId?: string | null
  branchName?: string | null
  materialId: string
  workOrderId?: string | null
  materialRequestId?: string | null
  movementType: string
  quantity: number
  balanceAfter: number
  reason?: string | null
  referenceNumber?: string | null
  createdByUserId?: string | null
  createdAt: string
}

export interface PreventiveMaintenancePlan {
  id: string
  branchId?: string | null
  branchName?: string | null
  assetId: string
  assetName?: string | null
  clientId?: string | null
  clientName?: string | null
  pmTemplateId?: string | null
  pmTemplateName?: string | null
  frequency: string
  serviceIntervalMonths?: number | null
  autoSchedule: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  status: string
  createdAt: string
}

export interface UpsertPreventiveMaintenanceInput {
  assetId: string
  pmTemplateId?: string | null
  frequency?: string | null
  serviceIntervalMonths?: number | null
  autoSchedule: boolean
  lastPmDate?: string | null
  nextPmDate?: string | null
  status?: string | null
}

export interface UserRecord {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
  role: string
  jobTitle?: string | null
  department?: string | null
  isActive: boolean
  hasAllBranchAccess: boolean
  defaultBranchId?: string | null
  defaultBranchName?: string | null
  branchIds: string[]
  linkedTechnicianId?: string | null
  assignmentGroups: Array<{
    id: string
    name: string
    isLead: boolean
  }>
  createdAt: string
  updatedAt?: string | null
  permissions: ApiPermissions
  mustChangePassword: boolean
  lastCredentialSentAt?: string | null
  credentialDelivery?: {
    success: boolean
    status: string
    message?: string | null
  } | null
}

export interface UpsertUserInput {
  fullName: string
  email: string
  phoneNumber?: string | null
  password?: string | null
  credentialDeliveryMethod?: 'InviteEmail' | 'TemporaryPassword' | 'Both'
  role: string
  jobTitle?: string | null
  department?: string | null
  isActive?: boolean
  permissions?: ApiPermissions
  branchIds?: string[]
  defaultBranchId?: string | null
  hasAllBranchAccess: boolean
  assignmentGroupIds?: string[]
}

export interface BranchRecord {
  id: string
  tenantId: string
  parentBranchId?: string | null
  name: string
  code: string
  location?: string | null
  address?: string | null
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface UpsertBranchInput {
  parentBranchId?: string | null
  name: string
  code: string
  location?: string | null
  address?: string | null
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
}

export interface TechnicianRecord {
  id: string
  branchId?: string | null
  branchName?: string | null
  fullName: string
  email: string
  phone?: string | null
  skillCategory?: string | null
  assignmentGroup?: string | null
  lastKnownLatitude?: number | null
  lastKnownLongitude?: number | null
  lastLocationAt?: string | null
  isTrackingActive: boolean
  activeWorkOrderId?: string | null
  isActive: boolean
  createdAt: string
}

export interface WorkOrderEventRecord {
  id: string
  eventType: string
  status?: string | null
  message: string
  actorUserId?: string | null
  latitude?: number | null
  longitude?: number | null
  occurredAt: string
}

export interface MaterialRequestLine {
  id: string
  materialItemId: string
  itemCode?: string | null
  itemName?: string | null
  quantityRequested: number
  quantityIssued: number
  quantityUsed: number
  quantityReturned: number
}

export interface MaterialRequestRecord {
  id: string
  requestNumber: string
  branchId?: string | null
  branchName?: string | null
  workOrderId: string
  workOrderNumber?: string | null
  requestedByUserId: string
  requestedByName?: string | null
  status: string
  createdAt: string
  lines: MaterialRequestLine[]
}

export interface TemplateChecklistItemRecord {
  id: string
  question: string
  type: 'text' | 'boolean' | 'number'
  required: boolean
  order: number
}

export interface TemplateRecord {
  id: string
  category: 'HVAC' | 'Generator' | 'UPS' | 'Solar'
  name: string
  description?: string | null
  checklist: TemplateChecklistItemRecord[]
  isActive: boolean
}

export interface UpsertTemplateInput {
  name: string
  category: 'HVAC' | 'Generator' | 'UPS' | 'Solar'
  description?: string | null
  checklist: Array<{
    question: string
    type: 'text' | 'boolean' | 'number'
    required: boolean
    order: number
  }>
  isActive: boolean
}

export interface ImportPreviewRow {
  rowNumber: number
  rawValues: Record<string, string | null>
  isValid: boolean
  errors: string[]
}

export interface ImportPreviewResponse {
  importType: string
  totalRows: number
  rows: ImportPreviewRow[]
}

export interface ImportCommitResponse {
  totalRows: number
  successfulRows: number
  failedRows: number
  skippedRows: number
}

export interface PlatformSummary {
  totalTenants: number
  activeTenants: number
  activeUsersNow: number
  loggedInToday: number
  tenantsWithActiveUsers: number
}

export interface PlatformReportsSummary {
  totalTenants: number
  activeTenants: number
  deactivatedTenants?: number
  suspendedTenants?: number
  inactiveTenants?: number
  totalUsers: number
  activeUsers?: number
  monthlyRevenue?: number
  outstandingInvoices?: number
  totalExpenses?: number
  netProfit?: number
  openWorkOrders: number
  closedWorkOrders: number
  overdueWorkOrders: number
  totalInvoices?: number
  overdueInvoices?: number
  totalRevenue?: number
  outstandingBalance?: number
  monthlyRecurringRevenue?: number
  slaCompliancePercent?: number
  asAtMonthStartUtc: string
}

export interface PlatformTenant {
  tenantId: string
  name: string
  slug: string
  contactName?: string | null
  contactEmail?: string | null
  planName?: string | null
  licenseStatus: PlatformLicenseStatus
  userCount: number
  branchCount: number
  status: PlatformTenantStatus
  trialStartsAt?: string | null
  trialEndsAt?: string | null
  trialExtensionUsed: boolean
  trialExtendedAt?: string | null
  trialDaysRemaining?: number | null
  trialStatus: string
  createdAt: string
}

export type PlatformTenantStatus = 'Active' | 'Suspended' | 'Trial' | 'Inactive'

export type PlatformLicenseStatus = 'Trial' | 'Active' | 'Expired' | 'Suspended'

export interface PlatformTenantDetail {
  tenantId: string
  name: string
  slug: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  country?: string | null
  industry?: string | null
  county?: string | null
  city?: string | null
  address?: string | null
  taxPin?: string | null
  status: PlatformTenantStatus
  planName?: string | null
  licenseStatus: PlatformLicenseStatus
  maxUsers?: number | null
  maxBranches?: number | null
  trialStartsAt?: string | null
  trialEndsAt?: string | null
  trialExtensionUsed: boolean
  trialExtendedAt?: string | null
  trialDaysRemaining?: number | null
  trialStatus: string
  subscriptionStartsAt?: string | null
  subscriptionEndsAt?: string | null
  createdAt: string
  updatedAt?: string | null
  createdByUserId?: string | null
  updatedByUserId?: string | null
  userCount: number
  branchCount: number
  workOrderCount: number
  activeUsersNow: number
  lastActivityAt?: string | null
  initialAdminInvitationSent?: boolean | null
  initialAdminInvitationMessage?: string | null
}

export interface PlatformTenantSummary {
  tenantId: string
  userCount: number
  branchCount: number
  workOrderCount: number
  activeUsersNow: number
  lastActivityAt?: string | null
}

export interface PlatformSession {
  userFullName: string
  email: string
  role: string
  jobTitle?: string | null
  loginAt: string
  lastSeenAt: string
  logoutAt?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  isActive: boolean
}

export interface PlatformTenantActiveCount {
  tenantId: string
  activeUsersNow: number
  loggedInToday: number
  lastActivityAt?: string | null
}

export interface PlatformTenantAuditLog {
  id: string
  action: string
  actor: string
  details?: string | null
  createdAt: string
}

export interface UpsertPlatformTenantInput {
  name: string
  slug: string
  companyEmail?: string | null
  companyPhone?: string | null
  industry?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  primaryContactName?: string | null
  primaryContactEmail?: string | null
  primaryContactPhone?: string | null
  country?: string | null
  county?: string | null
  city?: string | null
  address?: string | null
  taxPin?: string | null
  planName?: string | null
  maxUsers?: number | null
  maxBranches?: number | null
  trialEndsAt?: string | null
  subscriptionEndsAt?: string | null
  status: PlatformTenantStatus
  licenseStatus: PlatformLicenseStatus
  createDefaultAdmin?: boolean
  usePrimaryContactAsWorkspaceAdmin?: boolean
  adminFullName?: string | null
  adminEmail?: string | null
  adminPhone?: string | null
}

export interface UpdatePlatformTenantStatusInput {
  status: PlatformTenantStatus
  reason?: string | null
}

export interface LicensePlan {
  id: string
  planCode: string
  displayName: string
  maxUsers?: number | null
  maxBranches?: number | null
  maxAssets?: number | null
  monthlyWorkOrders?: number | null
  emailIngestion: boolean
  monitoringIntegration: boolean
  advancedReports: boolean
  clientPortal: boolean
  isActive: boolean
}

export interface TenantLicenseSnapshot {
  tenantId: string
  licensePlanId: string
  planCode: string
  planName: string
  status: string
  startsAt: string
  trialEndsAt?: string | null
  expiresAt?: string | null
  graceEndsAt?: string | null
  isReadOnly: boolean
  isSuspended: boolean
  isGracePeriod: boolean
  maxUsers?: number | null
  maxBranches?: number | null
  maxAssets?: number | null
  monthlyWorkOrders?: number | null
  emailIngestion: boolean
  monitoringIntegration: boolean
  advancedReports: boolean
  clientPortal: boolean
  warningMessage?: string | null
}

export interface LicenseUsageSnapshot {
  activeUsers: number
  activeBranches: number
  activeAssets: number
  monthlyWorkOrders: number
}

export interface PlatformLicenseUsageSnapshot {
  tenantId: string
  companyName: string
  planCode: string
  status: string
  activeUsers: number
  activeBranches: number
  activeAssets: number
  monthlyWorkOrders: number
  maxUsers?: number | null
  maxBranches?: number | null
  maxAssets?: number | null
  monthlyWorkOrdersLimit?: number | null
  isReadOnly: boolean
  isSuspended: boolean
  expiresAt?: string | null
  graceEndsAt?: string | null
}

export interface AssignmentGroupRecord {
  id: string
  name: string
  description?: string | null
  skillArea?: string | null
  branchId?: string | null
  branchName?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string | null
  members: Array<{
    id: string
    assignmentGroupId: string
    userId?: string | null
    technicianId: string
    memberName?: string | null
    email?: string | null
    isLead: boolean
    isActive: boolean
    addedAt: string
  }>
  technicianIds: string[]
}

export interface UpsertAssignmentGroupInput {
  name: string
  description?: string | null
  skillArea?: string | null
  branchId?: string | null
  isActive: boolean
  technicianIds: string[]
  members?: Array<{
    userId?: string
    technicianId?: string
    isLead: boolean
  }>
}

export interface BrandingSettings {
  logoUrl?: string | null
  primaryColor: string
  secondaryColor: string
  showPoweredByEcosys: boolean
}

export interface TenantSecuritySettings {
  id?: string
  tenantId?: string
  minPasswordLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireSpecialCharacter: boolean
  passwordRotationDays: number
  sessionTimeoutMinutes: number
  requireMfa: boolean
}

export interface NotificationSettings {
  id?: string
  tenantId?: string
  emailAlertsEnabled: boolean
  smsAlertsEnabled: boolean
  workOrderAssignmentAlerts: boolean
  licenseExpiryAlerts: boolean
  dailyDigestEnabled: boolean
}

export interface MonitoringSettings {
  id?: string
  tenantId?: string
  providerName: string
  endpointLabel?: string | null
  webhookSecret?: string | null
  defaultBranchId?: string | null
  defaultPriority: string
  autoCreateWorkOrders: boolean
  isEnabled: boolean
}

export interface EmailNotificationSettings {
  id: string
  tenantId: string
  isEnabled: boolean
  deliveryMode: 'Smtp' | 'Api' | 'Disabled'
  fromName: string
  fromEmail: string
  replyToEmail?: string | null
  smtpHost: string
  smtpPort: number
  enableSslTls: boolean
  secureMode: 'Auto' | 'None' | 'StartTls' | 'SslOnConnect'
  smtpUsername?: string | null
  apiEndpoint?: string | null
  apiKeyMasked?: string | null
  apiProviderName?: string | null
  timeoutSeconds: number
  maxRetries: number
  hasSecret: boolean
  isConfigured: boolean
  lastTestedAt?: string | null
  lastError?: string | null
}

export interface UpdateEmailNotificationSettingsInput {
  isEnabled: boolean
  deliveryMode: 'Smtp' | 'Api' | 'Disabled'
  fromName: string
  fromEmail: string
  replyToEmail?: string | null
  smtpHost: string
  smtpPort: number
  enableSslTls: boolean
  secureMode: 'Auto' | 'None' | 'StartTls' | 'SslOnConnect'
  smtpUsername?: string | null
  smtpPasswordSecret?: string | null
  apiEndpoint?: string | null
  apiKeySecret?: string | null
  apiProviderName?: string | null
  timeoutSeconds: number
  maxRetries: number
}

export interface EmailIntakeSettings {
  id: string
  tenantId: string
  isEnabled: boolean
  intakeEmailAddress?: string | null
  mailboxProvider: string
  host: string
  port: number
  useSsl: boolean
  username?: string | null
  hasPassword: boolean
  defaultClientId?: string | null
  defaultBranchId?: string | null
  defaultAssignmentGroupId?: string | null
  defaultPriority: string
  createWorkOrderFromUnknownSender: boolean
  subjectParsingRules?: string | null
  allowedSenderDomains?: string | null
  lastCheckedAt?: string | null
  isConnectionHealthy: boolean
  lastError?: string | null
}

export interface UpdateEmailIntakeSettingsInput {
  isEnabled: boolean
  intakeEmailAddress?: string | null
  mailboxProvider: string
  host: string
  port: number
  useSsl: boolean
  username?: string | null
  password?: string | null
  defaultClientId?: string | null
  defaultBranchId?: string | null
  defaultAssignmentGroupId?: string | null
  defaultPriority: string
  createWorkOrderFromUnknownSender: boolean
  subjectParsingRules?: string | null
  allowedSenderDomains?: string | null
}

export type IntakeProtocolSourceType = 'Email' | 'Monitoring'

export interface IntakeProtocolRecord {
  id: string
  tenantId: string
  name: string
  sourceType: IntakeProtocolSourceType
  isActive: boolean
  description?: string | null
  criteriaJson: string
  actionsJson: string
  sourceConfigJson: string
  createdAt: string
  updatedAt?: string | null
  lastTriggeredAt?: string | null
  lastTriggerStatus?: string | null
  lastError?: string | null
}

export interface UpsertIntakeProtocolInput {
  name: string
  sourceType: IntakeProtocolSourceType
  isActive: boolean
  description?: string | null
  criteriaJson: string
  actionsJson: string
  sourceConfigJson: string
}

export interface IntakeProtocolTestResponse {
  success: boolean
  lastTriggeredAt?: string | null
  lastTriggerStatus?: string | null
  lastError?: string | null
}

export interface MonitoringWebhookIntegrationRecord {
  id: string
  tenantId: string
  name: string
  toolType: string
  endpointSlug: string
  endpointUrl?: string | null
  isActive: boolean
  defaultClientId?: string | null
  defaultAssetId?: string | null
  defaultBranchId?: string | null
  defaultAssignmentGroupId?: string | null
  defaultPriority: string
  createWorkOrderOnAlert: boolean
  payloadMappingJson?: string | null
  lastReceivedAt?: string | null
  lastStatus?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt?: string | null
  hasSecret: boolean
  generatedSecret?: string | null
}

export interface UpsertMonitoringWebhookIntegrationInput {
  name: string
  toolType: string
  isActive: boolean
  defaultClientId?: string | null
  defaultAssetId?: string | null
  defaultBranchId?: string | null
  defaultAssignmentGroupId?: string | null
  defaultPriority: string
  createWorkOrderOnAlert: boolean
  payloadMappingJson?: string | null
}

export interface NumberingRuleRecord {
  id: string
  documentType: string
  prefix: string
  nextNumber: number
  paddingLength: number
  resetPeriod: string
  preview: string
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface UpdateNumberingRuleInput {
  prefix: string
  nextNumber: number
  paddingLength: number
  resetPeriod: string
  isActive: boolean
}

export interface EmailTemplateRecord {
  eventKey: string
  templateName: string
  subject: string
  htmlBody: string
  textBody: string
  enabled: boolean
  senderNameOverride?: string | null
  replyToOverride?: string | null
  availablePlaceholders: string[]
  requiredPlaceholders: string[]
  supportsTenantOverride: boolean
  isOverride: boolean
  source: string
  lastUpdatedBy?: string | null
  lastUpdatedAt?: string | null
}

export interface UpdateEmailTemplateInput {
  templateName: string
  subject: string
  htmlBody: string
  textBody?: string | null
  enabled: boolean
  senderNameOverride?: string | null
  replyToOverride?: string | null
}

export interface EmailTemplatePreviewResponse {
  eventKey: string
  templateName: string
  templateSubject: string
  finalSubject: string
  htmlBody: string
  textBody: string
}

export interface EmailTemplateTestResponse {
  success: boolean
  message?: string | null
}

export interface PmTemplateQuestionRecord {
  id: string
  sectionName?: string | null
  question: string
  type: 'text' | 'boolean' | 'number' | 'date' | 'dropdown' | 'yesno' | 'passfail'
  required: boolean
  order: number
  options?: string[]
}

export interface PmTemplateRecord {
  id: string
  category: 'HVAC' | 'Generator' | 'UPS' | 'Solar'
  name: string
  description?: string | null
  isActive: boolean
  checklist: PmTemplateQuestionRecord[]
}

export interface UpsertPmTemplateInput {
  category: 'HVAC' | 'Generator' | 'UPS' | 'Solar'
  name: string
  description?: string | null
  isActive: boolean
  checklist: Array<{
    sectionName?: string | null
    question: string
    type: 'text' | 'boolean' | 'number' | 'date' | 'dropdown' | 'yesno' | 'passfail'
    required: boolean
    order: number
    options?: string[]
  }>
}

export interface SiteRecord {
  id: string
  tenantId: string
  clientId: string
  siteCode: string
  siteName: string
  siteType: string
  status: string
  streetAddress?: string | null
  areaEstate?: string | null
  townCity?: string | null
  county?: string | null
  country?: string | null
  region?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  alternateContact?: string | null
  operatingHours?: string | null
  accessNotes?: string | null
  specialInstructions?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface UpsertSiteInput {
  siteName: string
  siteType?: string | null
  streetAddress?: string | null
  areaEstate?: string | null
  townCity?: string | null
  county?: string | null
  country?: string | null
  region?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  alternateContact?: string | null
  operatingHours?: string | null
  accessNotes?: string | null
  specialInstructions?: string | null
}

export interface AttachmentRecord {
  id: string
  entityType: string
  entityId: string
  fileName: string
  fileSize: number
  mimeType: string
  publicUrl: string
  uploadedByUserId: string
  createdAt: string
}

export interface WorkOrderChecklistItemRecord {
  id: string
  pmTemplateQuestionId?: string | null
  sectionName?: string | null
  questionText: string
  inputType: 'text' | 'number' | 'date' | 'dropdown' | 'yesno' | 'passfail' | 'boolean' | string
  isRequired: boolean
  sortOrder: number
  responseValue?: string | null
  remarks?: string | null
  isCompleted: boolean
  completedByUserId?: string | null
  completedAt?: string | null
  options: string[]
}

export interface KnowledgeCategoryRecord {
  id: string
  name: string
  description?: string | null
  displayOrder: number
  isActive: boolean
}

export interface UpsertKnowledgeCategoryInput {
  name: string
  description?: string | null
  displayOrder: number
}

export interface KnowledgeArticleListItem {
  id: string
  title: string
  slug: string
  summary?: string | null
  categoryId?: string | null
  categoryName?: string | null
  status: 'Draft' | 'Published' | 'Archived' | string
  visibility: 'Internal' | 'TechnicianOnly' | 'AdminOnly' | string
  publishedAt?: string | null
  updatedAt: string
  tags: string[]
}

export interface KnowledgeArticleVersionRecord {
  id: string
  versionNumber: number
  title: string
  body: string
  updatedByUserId?: string | null
  createdAt: string
}

export interface KnowledgeArticleDetail {
  id: string
  title: string
  slug: string
  summary?: string | null
  body: string
  categoryId?: string | null
  categoryName?: string | null
  status: 'Draft' | 'Published' | 'Archived' | string
  visibility: 'Internal' | 'TechnicianOnly' | 'AdminOnly' | string
  createdByUserId: string
  createdByName?: string | null
  updatedByUserId?: string | null
  updatedByName?: string | null
  createdAt: string
  updatedAt?: string | null
  publishedAt?: string | null
  sourceWorkOrderId?: string | null
  tags: string[]
  versions: KnowledgeArticleVersionRecord[]
  relatedArticles: KnowledgeArticleListItem[]
}

export interface UpsertKnowledgeArticleInput {
  title: string
  summary?: string | null
  body: string
  categoryId?: string | null
  status: 'Draft' | 'Published' | 'Archived' | string
  visibility: 'Internal' | 'TechnicianOnly' | 'AdminOnly' | string
  tags: string[]
}
