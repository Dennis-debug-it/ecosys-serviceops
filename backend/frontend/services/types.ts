export type AppRole = "SuperAdmin" | "Admin" | "User";

export interface PermissionSet {
  canViewWorkOrders: boolean;
  canCreateWorkOrders: boolean;
  canAssignWorkOrders: boolean;
  canCompleteWorkOrders: boolean;
  canApproveMaterials: boolean;
  canIssueMaterials: boolean;
  canManageAssets: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  email: string;
  role: AppRole;
  jobTitle?: string | null;
  department?: string | null;
  hasAllBranchAccess: boolean;
  defaultBranchId?: string | null;
  permissions: PermissionSet;
}

export interface AuthenticatedTenant {
  tenantId: string;
  companyName: string;
  country?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface AuthenticatedBranch {
  id: string;
  name: string;
  code: string;
  location?: string | null;
  isActive: boolean;
}

export interface AuthenticatedContextResponse {
  user: AuthenticatedUser;
  tenant: AuthenticatedTenant;
  branches: AuthenticatedBranch[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: AppRole;
    jobTitle?: string | null;
  };
  tenant: {
    id: string;
    companyName: string;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
  };
}

export interface BranchMetric {
  branchId?: string | null;
  branchName?: string | null;
  count: number;
}

export interface DashboardSummary {
  totalBranches: number;
  activeBranches: number;
  openWorkOrders: number;
  completedWorkOrders: number;
  overdueWorkOrders: number;
  lowStockCount: number;
  activeUsers: number;
  workOrdersByBranch: BranchMetric[];
  materialsLowStockByBranch: BranchMetric[];
}

export interface ClientSummary {
  id: string;
  clientName: string;
  clientType?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  slaPlan?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AssetSummary {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  clientId: string;
  clientName?: string | null;
  assetName: string;
  assetCode: string;
  assetType?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  installationDate?: string | null;
  warrantyExpiryDate?: string | null;
  recommendedPmFrequency?: string | null;
  autoSchedulePm: boolean;
  lastPmDate?: string | null;
  nextPmDate?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export interface TechnicianSummary {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  skillCategory?: string | null;
  assignmentGroup?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  clientId: string;
  clientName?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  workOrderNumber: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  dueDate?: string | null;
  createdAt: string;
  completedAt?: string | null;
  workDoneNotes?: string | null;
  acknowledgedByName?: string | null;
  acknowledgementComments?: string | null;
  acknowledgementDate?: string | null;
  isPreventiveMaintenance: boolean;
}

export interface CreateWorkOrderPayload {
  clientId: string;
  branchId?: string | null;
  assetId?: string | null;
  title: string;
  description?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  isPreventiveMaintenance: boolean;
}

export interface AssignWorkOrderPayload {
  technicianId: string;
}

export interface CompleteWorkOrderPayload {
  workDoneNotes: string;
  completedAt?: string | null;
  technicianId?: string | null;
}

export interface MaterialItem {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  itemCode: string;
  itemName: string;
  category?: string | null;
  unitOfMeasure: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost?: number | null;
  isActive: boolean;
  isLowStock: boolean;
  createdAt: string;
}

export interface CreateMaterialPayload {
  itemCode: string;
  itemName: string;
  category?: string | null;
  unitOfMeasure: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost?: number | null;
  branchId?: string | null;
}

export interface ReplenishMaterialPayload {
  branchId?: string | null;
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  referenceNumber?: string | null;
}

export interface AdjustMaterialPayload {
  branchId?: string | null;
  quantityChange: number;
  reason?: string | null;
}

export interface StockMovement {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  materialId: string;
  workOrderId?: string | null;
  materialRequestId?: string | null;
  movementType: string;
  quantity: number;
  balanceAfter: number;
  reason?: string | null;
  referenceNumber?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface BranchSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  location?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  jobTitle?: string | null;
  department?: string | null;
  isActive: boolean;
  hasAllBranchAccess: boolean;
  defaultBranchId?: string | null;
  branchIds: string[];
  createdAt: string;
  updatedAt?: string | null;
  permissions: PermissionSet;
}

export interface UpsertUserPayload {
  fullName: string;
  email: string;
  password?: string;
  role: Exclude<AppRole, "SuperAdmin">;
  jobTitle?: string | null;
  department?: string | null;
  isActive?: boolean;
  permissions?: PermissionSet;
  branchIds?: string[];
  defaultBranchId?: string | null;
  hasAllBranchAccess: boolean;
}

export interface CompanySettings {
  companyName: string;
  email: string;
  phone?: string | null;
  country: string;
  industry?: string | null;
  primaryColor: string;
  secondaryColor: string;
  showPoweredByEcosys: boolean;
}

export interface EmailSettings {
  host: string;
  port: number;
  useSsl: boolean;
  username?: string | null;
  password?: string | null;
  senderName: string;
  senderAddress: string;
}

export interface NumberingSettings {
  id: string;
  branchId?: string | null;
  branchName?: string | null;
  documentType: string;
  prefix: string;
  nextNumber: number;
  paddingLength: number;
  resetFrequency: string;
  includeYear: boolean;
  includeMonth: boolean;
  isActive: boolean;
}

export interface UpsertNumberingSettingsPayload {
  branchId?: string | null;
  documentType: string;
  prefix: string;
  nextNumber: number;
  paddingLength: number;
  resetFrequency: string;
  includeYear: boolean;
  includeMonth: boolean;
  isActive: boolean;
}

export interface ApiErrorPayload {
  message?: string;
  title?: string;
  detail?: string;
  errors?: string[];
}
