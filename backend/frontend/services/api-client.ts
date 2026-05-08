import axios from "axios";
import type { ApiErrorPayload } from "@/services/types";
import { useAuthStore } from "@/store/auth-store";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5072";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const { token, activeBranchId } = useAuthStore.getState();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (activeBranchId) {
    config.headers["X-Branch-Id"] = activeBranchId;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as ApiErrorPayload | string | undefined;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    if (data.message) {
      return data.message;
    }

    if (data.title) {
      return data.title;
    }

    if (data.detail) {
      return data.detail;
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0];
    }
  }

  return fallback;
}
