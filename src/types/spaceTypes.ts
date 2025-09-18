import { OptionType } from "./generalTypes";

export interface DashboardData {
  id: string;
  categoryOptions: OptionType[];
  accountOptions: OptionType[];
  expenseCategoryOptions: OptionType[];
  incomeCategoryOptions: OptionType[];
  goalDescription: string;
}

// Space-related types
export interface Space {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  isPersonal: boolean;
  isOrganization: boolean;
  userRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpacePermissions {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewAnalytics: boolean;
  canManageBudgets: boolean;
}

export interface SpaceFeatures {
  aiEnabled: boolean;
  advancedReporting: boolean;
  teamCollaboration: boolean;
}

export interface SpaceContext {
  space: Space;
  permissions: SpacePermissions;
  features: SpaceFeatures;
}

export interface CreateSpaceRequest {
  name: string;
  currency: string;
}

export interface GrantAccessRequest {
  email: string;
  role: "admin" | "member";
}

export interface SpaceUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  joinedAt: string;
}
