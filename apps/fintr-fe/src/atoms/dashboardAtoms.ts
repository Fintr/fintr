import { atom } from 'jotai';
import { OptionType, AccountOptionWithCurrency } from '@/types/generalTypes';
import { CategoryTreeOption } from '@/types/categoryTreeTypes';
import { DashboardData } from '@/types/spaceTypes';

// Atoms to store dashboard data directly
export const dashboardDataAtom = atom<DashboardData | null>(null);

// Helper function to set dashboard data - we'll call this from components
export const setDashboardData = (data: DashboardData, setAtom: any) => {
  setAtom(data);
};

// Atoms for storing other shared data
export const categoryOptionsAtom = atom<OptionType[]>([]);
export const accountOptionsAtom = atom<AccountOptionWithCurrency[]>([]);
export const expenseCategoryOptionsAtom = atom<CategoryTreeOption[]>([]);
export const incomeCategoryOptionsAtom = atom<CategoryTreeOption[]>([]); 
export const isAdminAtom = atom<boolean | null>(null);

/** True when dashboard layout has spaceCode and finished loading shell data (nav + tabs). */
export const dashboardShellReadyAtom = atom(false);
