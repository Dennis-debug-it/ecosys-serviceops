"use client";

import { useAuthStore } from "@/store/auth-store";

export function useAccess() {
  const user = useAuthStore((state) => state.user);

  return {
    user,
    isAuthenticated: Boolean(user),
    isSuperAdmin: user?.role === "SuperAdmin",
    isAdmin: user?.role === "Admin",
    isUser: user?.role === "User",
    canViewWorkOrders: user?.role === "Admin" || user?.permissions.canViewWorkOrders === true,
    canCreateWorkOrders: user?.role === "Admin" || user?.permissions.canCreateWorkOrders === true,
    canAssignWorkOrders: user?.role === "Admin" || user?.permissions.canAssignWorkOrders === true,
    canCompleteWorkOrders: user?.role === "Admin" || user?.permissions.canCompleteWorkOrders === true,
    canIssueMaterials: user?.role === "Admin" || user?.permissions.canIssueMaterials === true,
    canManageAssets: user?.role === "Admin" || user?.permissions.canManageAssets === true,
    canManageSettings: user?.role === "Admin" || user?.permissions.canManageSettings === true,
    canViewReports: user?.role === "Admin" || user?.permissions.canViewReports === true,
  };
}
