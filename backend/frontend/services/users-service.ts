import { apiClient } from "@/services/api-client";
import type { UpsertUserPayload, UserSummary } from "@/services/types";

export const usersService = {
  async getAll() {
    const response = await apiClient.get<UserSummary[]>("/api/users");
    return response.data;
  },
  async create(payload: UpsertUserPayload) {
    const response = await apiClient.post<UserSummary>("/api/users", payload);
    return response.data;
  },
  async update(id: string, payload: UpsertUserPayload) {
    const response = await apiClient.put<UserSummary>(`/api/users/${id}`, payload);
    return response.data;
  },
  async deactivate(id: string) {
    await apiClient.delete(`/api/users/${id}`);
  },
};
