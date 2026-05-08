import { apiClient } from "@/services/api-client";
import type {
  CompanySettings,
  EmailSettings,
  NumberingSettings,
  UpsertNumberingSettingsPayload,
} from "@/services/types";

export const settingsService = {
  async getCompany() {
    const response = await apiClient.get<CompanySettings>("/api/settings/company");
    return response.data;
  },
  async updateCompany(payload: CompanySettings) {
    const response = await apiClient.put<CompanySettings>("/api/settings/company", payload);
    return response.data;
  },
  async getEmail() {
    const response = await apiClient.get<EmailSettings>("/api/settings/email");
    return response.data;
  },
  async updateEmail(payload: EmailSettings) {
    const response = await apiClient.put<EmailSettings>("/api/settings/email", payload);
    return response.data;
  },
  async getNumbering(branchId?: string | null) {
    const response = await apiClient.get<NumberingSettings[]>("/api/settings/numbering", {
      params: branchId ? { branchId } : undefined,
    });
    return response.data;
  },
  async updateNumbering(payload: UpsertNumberingSettingsPayload) {
    const response = await apiClient.put<NumberingSettings>("/api/settings/numbering", payload);
    return response.data;
  },
};
