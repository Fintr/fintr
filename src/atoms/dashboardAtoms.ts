import { atom } from 'jotai';
import { OptionType } from '@/types/generalTypes';
import { DashboardData } from '@/types/spaceTypes';

// Atoms to store dashboard data directly
export const dashboardDataAtom = atom<DashboardData | null>(null);

// Helper function to set dashboard data - we'll call this from components
export const setDashboardData = (data: DashboardData, setAtom: any) => {
  setAtom(data);
};

// Atoms for storing other shared data
export const categoryOptionsAtom = atom<OptionType[]>([]);
export const accountOptionsAtom = atom<OptionType[]>([]);
export const expenseCategoryOptionsAtom = atom<OptionType[]>([]);
export const incomeCategoryOptionsAtom = atom<OptionType[]>([]); 
