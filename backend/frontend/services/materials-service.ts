import { apiClient } from "@/services/api-client";
import { withBranchParams } from "@/services/branch-scope";
import type {
  AdjustMaterialPayload,
  CreateMaterialPayload,
  MaterialItem,
  ReplenishMaterialPayload,
  StockMovement,
} from "@/services/types";

export const materialsService = {
  async getAll(filters?: { branchId?: string | null; lowStockOnly?: boolean }) {
    const response = await apiClient.get<MaterialItem[]>("/api/materials", {
      params: withBranchParams(
        {
          lowStockOnly: filters?.lowStockOnly ? true : undefined,
        },
        filters?.branchId,
      ),
    });
    return response.data;
  },
  async create(payload: CreateMaterialPayload) {
    const response = await apiClient.post<MaterialItem>("/api/materials", payload);
    return response.data;
  },
  async replenish(id: string, payload: ReplenishMaterialPayload) {
    const response = await apiClient.post<MaterialItem>(`/api/materials/${id}/replenish`, payload);
    return response.data;
  },
  async adjust(id: string, payload: AdjustMaterialPayload) {
    const response = await apiClient.post<MaterialItem>(`/api/materials/${id}/adjust`, payload);
    return response.data;
  },
  async getMovements(id: string, branchId?: string | null) {
    const response = await apiClient.get<StockMovement[]>(`/api/materials/${id}/movements`, {
      params: withBranchParams(undefined, branchId),
    });
    return response.data;
  },
};
