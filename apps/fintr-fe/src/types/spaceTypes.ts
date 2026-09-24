import { OptionType, AccountOptionWithCurrency } from "./generalTypes";
import { CategoryTreeOption } from "./categoryTreeTypes";

export interface FinancialSummary {
  totalIncome: string;
  totalExpenses: string;
  netSavings: string;
  savingsPercentage: string;
  calculatedAt: string;
}

export interface DashboardData {
  id: string;
  categoryOptions: OptionType[];
  accountOptions: AccountOptionWithCurrency[];
  expenseCategoryOptions: CategoryTreeOption[];
  incomeCategoryOptions: CategoryTreeOption[];
  goalDescription: string;
  /** Earliest calculated transaction date (excludes initial balance). */
  earliestTransactionDate?: string | null;
  financialSummary: FinancialSummary;
}

// Space-related types
export interface Space {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  /** When set, expense/income forms pre-select this currency. */
  defaultTransactionCurrency?: string | null;
  isPersonal: boolean;
  isOrganization: boolean;
  userRole: string;
  createdAt: string;
  updatedAt: string;
  hasNewInvitation: boolean;
  isOwner: boolean;
  ownerId: string | null;
  /** Joined members (excludes pending invite-only rows). Absent on older cached payloads. */
  memberCount?: number;
  /** Derived: solo | couple | household */
  compositionKey?: "solo" | "couple" | "household";
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
