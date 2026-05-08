"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthenticatedContextResponse, AuthenticatedTenant, AuthenticatedUser, AuthenticatedBranch } from "@/services/types";

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  tenant: AuthenticatedTenant | null;
  branches: AuthenticatedBranch[];
  activeBranchId: string | null;
  hasHydrated: boolean;
  bootstrapped: boolean;
  setToken: (token: string) => void;
  setAuthenticatedContext: (context: AuthenticatedContextResponse) => void;
  setActiveBranchId: (branchId: string | null) => void;
  setBootstrapped: (value: boolean) => void;
  clearAuth: () => void;
}

function resolveActiveBranchId(requestedBranchId: string | null, user: AuthenticatedUser, branches: AuthenticatedBranch[]) {
  if (requestedBranchId && branches.some((branch) => branch.id === requestedBranchId)) {
    return requestedBranchId;
  }

  if (user.defaultBranchId && branches.some((branch) => branch.id === user.defaultBranchId)) {
    return user.defaultBranchId;
  }

  if (branches.length === 1) {
    return branches[0].id;
  }

  return null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      branches: [],
      activeBranchId: null,
      hasHydrated: false,
      bootstrapped: false,
      setToken: (token) =>
        set({
          token,
          bootstrapped: false,
        }),
      setAuthenticatedContext: (context) => {
        const activeBranches = context.branches.filter((branch) => branch.isActive);

        set((state) => ({
          user: context.user,
          tenant: context.tenant,
          branches: activeBranches,
          activeBranchId: resolveActiveBranchId(state.activeBranchId, context.user, activeBranches),
          bootstrapped: true,
        }));
      },
      setActiveBranchId: (branchId) =>
        set({
          activeBranchId: branchId,
        }),
      setBootstrapped: (value) =>
        set({
          bootstrapped: value,
        }),
      clearAuth: () =>
        set({
          token: null,
          user: null,
          tenant: null,
          branches: [],
          activeBranchId: null,
          bootstrapped: true,
        }),
    }),
    {
      name: "ecosys-frontend-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tenant: state.tenant,
        branches: state.branches,
        activeBranchId: state.activeBranchId,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({
          hasHydrated: true,
          bootstrapped: false,
        });
      },
    },
  ),
);
