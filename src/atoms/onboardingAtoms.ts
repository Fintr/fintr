import { atom } from 'jotai';

export type OnboardingStep = 'income' | 'budgets' | 'accounts' | 'completed';

export interface OnboardingData {
  step: OnboardingStep;
  incomeData?: {
    salary: number;
    business: number;
  };
  budgetsData?: any; // We'll define this later
  accountsData?: any; // We'll define this later
}

// Atom to store the current onboarding step
export const onboardingStepAtom = atom<OnboardingStep | null>(null);

// Atom to store onboarding data
export const onboardingDataAtom = atom<OnboardingData>({
  step: 'income'
});

// Derived atom to check if onboarding is completed
export const isOnboardingCompletedAtom = atom<boolean>(
  (get) => get(onboardingStepAtom) === 'completed'
);
