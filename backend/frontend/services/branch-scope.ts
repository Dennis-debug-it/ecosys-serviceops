import { useAuthStore } from "@/store/auth-store";

export function getActiveBranchId() {
  return useAuthStore.getState().activeBranchId;
}

export function withBranchParams<T extends Record<string, string | number | boolean | undefined | null>>(
  params?: T,
  overrideBranchId?: string | null,
) {
  const branchId = overrideBranchId === undefined ? getActiveBranchId() : overrideBranchId;
  const nextParams = { ...(params ?? {}) } as Record<string, string | number | boolean>;

  if (branchId) {
    nextParams.branchId = branchId;
  }

  return nextParams;
}
