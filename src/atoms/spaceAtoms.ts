import { atom } from "jotai";
import { Space, SpacePermissions, SpaceFeatures } from "@/types/spaceTypes";

export const currentSpaceAtom = atom<Space | null>(null);
export const availableSpacesAtom = atom<Space[]>([]);
export const spacePermissionsAtom = atom<SpacePermissions | null>(null);
export const spaceFeaturesAtom = atom<SpaceFeatures | null>(null);

// Derived atoms
export const isPersonalSpaceAtom = atom(
  (get) => get(currentSpaceAtom)?.isPersonal ?? false
);

export const isOrganizationSpaceAtom = atom(
  (get) => get(currentSpaceAtom)?.isOrganization ?? false
);

export const canManageUsersAtom = atom(
  (get) => get(spacePermissionsAtom)?.canManageUsers ?? false
);

export const canManageSettingsAtom = atom(
  (get) => get(spacePermissionsAtom)?.canManageSettings ?? false
);

export const canViewAnalyticsAtom = atom(
  (get) => get(spacePermissionsAtom)?.canViewAnalytics ?? false
);

export const canManageBudgetsAtom = atom(
  (get) => get(spacePermissionsAtom)?.canManageBudgets ?? false
);

export const teamCollaborationEnabledAtom = atom(
  (get) => get(spaceFeaturesAtom)?.teamCollaboration ?? false
);

export const advancedReportingEnabledAtom = atom(
  (get) => get(spaceFeaturesAtom)?.advancedReporting ?? false
);

