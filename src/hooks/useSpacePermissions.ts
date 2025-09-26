"use client";
import { useAtomValue } from "jotai";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";

export function useSpacePermissions() {
  const currentSpace = useAtomValue(currentSpaceAtom);
  
  // Derive permissions from current space role
  const isAdmin = currentSpace?.userRole === 'admin';
  const isMember = currentSpace?.userRole === 'member';

  return {
    canManageUsers: isAdmin,
    canManageSettings: isAdmin,
    canViewAnalytics: isAdmin || currentSpace?.userRole === 'analyst',
    canManageBudgets: isAdmin || currentSpace?.userRole === 'budget_manager',
    hasAnyPermission: isAdmin || isMember,
    permissions: {
      canManageUsers: isAdmin,
      canManageSettings: isAdmin,
      canViewAnalytics: isAdmin || currentSpace?.userRole === 'analyst',
      canManageBudgets: isAdmin || currentSpace?.userRole === 'budget_manager',
    }
  };
}

