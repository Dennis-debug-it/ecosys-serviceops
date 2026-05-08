import { apiClient } from "@/services/api-client";
import { withBranchParams } from "@/services/branch-scope";
import type {
  AssignWorkOrderPayload,
  CompleteWorkOrderPayload,
  CreateWorkOrderPayload,
  WorkOrder,
} from "@/services/types";

export const workOrdersService = {
  async getAll(filters: {
    branchId?: string | null;
    status?: string;
    technicianId?: string;
  }) {
    const response = await apiClient.get<WorkOrder[]>("/api/workorders", {
      params: withBranchParams(
        {
          status: filters.status || undefined,
          technicianId: filters.technicianId || undefined,
        },
        filters.branchId,
      ),
    });

    return response.data;
  },
  async create(payload: CreateWorkOrderPayload) {
    const response = await apiClient.post<WorkOrder>("/api/workorders", payload);
    return response.data;
  },
  async assign(id: string, payload: AssignWorkOrderPayload) {
    const response = await apiClient.post<WorkOrder>(`/api/workorders/${id}/assign`, payload);
    return response.data;
  },
  async complete(id: string, payload: CompleteWorkOrderPayload) {
    const response = await apiClient.post<WorkOrder>(`/api/workorders/${id}/complete`, payload);
    return response.data;
  },
};
