import { apiClient } from "@/services/api-client";
import { withBranchParams } from "@/services/branch-scope";
import type { AssetSummary, BranchSummary, ClientSummary, TechnicianSummary } from "@/services/types";

export const lookupsService = {
  async getBranches() {
    const response = await apiClient.get<BranchSummary[]>("/api/branches");
    return response.data;
  },
  async getClients() {
    const response = await apiClient.get<ClientSummary[]>("/api/clients");
    return response.data;
  },
  async getAssets(branchId?: string | null) {
    const response = await apiClient.get<AssetSummary[]>("/api/assets", {
      params: withBranchParams(undefined, branchId),
    });
    return response.data;
  },
  async getTechnicians(branchId?: string | null) {
    const response = await apiClient.get<TechnicianSummary[]>("/api/technicians", {
      params: withBranchParams(undefined, branchId),
    });
    return response.data;
  },
};
