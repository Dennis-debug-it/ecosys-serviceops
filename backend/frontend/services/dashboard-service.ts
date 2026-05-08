import { apiClient } from "@/services/api-client";
import { withBranchParams } from "@/services/branch-scope";
import type { DashboardSummary } from "@/services/types";

export const dashboardService = {
  async getSummary(branchId?: string | null) {
    const response = await apiClient.get<DashboardSummary>("/api/dashboard/summary", {
      params: withBranchParams(undefined, branchId),
    });

    return response.data;
  },
};
