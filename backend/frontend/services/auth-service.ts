import { apiClient } from "@/services/api-client";
import type { AuthenticatedContextResponse, LoginRequest, LoginResponse } from "@/services/types";

export const authService = {
  async login(payload: LoginRequest) {
    const response = await apiClient.post<LoginResponse>("/api/auth/login", payload);
    return response.data;
  },
  async logout() {
    await apiClient.post("/api/auth/logout");
  },
  async getCurrentContext() {
    const response = await apiClient.get<AuthenticatedContextResponse>("/api/auth/me");
    return response.data;
  },
};
