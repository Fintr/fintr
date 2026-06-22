import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useAuthApi } from '@/hooks/useAuthApi';
import {
  saveCurrencyStepData,
  saveStep1Data,
  saveStep2Data,
  saveStep3Data,
  skipOnboardingSetup,
  SaveCurrencyStepArgs,
  SaveStep1DataArgs,
  SaveStep2DataArgs,
  SaveStep3DataArgs,
} from '@/services/onboarding/mutations';
import { getOnboardingData } from '@/services/onboarding/queries';
import { onboardingBudgetCategoriesAtom, onboardingAccountsDataAtom, onboardingAccountCategoriesAtom, incomeRequirementsAtom } from '@/atoms/budgetAtoms';
import { toast } from 'sonner';
import { onboardingDataAtom, onboardingStepAtom } from '@/atoms/onboardingAtoms';

export const useOnboarding = (step?: string) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const queryClient = useQueryClient();
  const [budgetCategories, setBudgetCategories] = useAtom(onboardingBudgetCategoriesAtom);
  const [accountsData, setAccountsData] = useAtom(onboardingAccountsDataAtom);
  const setOnboardingData = useSetAtom(onboardingDataAtom);
  const setOnboardingStep = useSetAtom(onboardingStepAtom);
  const currentOnboardingStep = useAtomValue(onboardingStepAtom);
  const setAccountCategories = useSetAtom(onboardingAccountCategoriesAtom);
  const setIncomeRequirements = useSetAtom(incomeRequirementsAtom);

  const invalidateUserContext = () => {
    void queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
  };

  const invalidateWorkspaceLists = () => {
    queueMicrotask(() => {
      void queryClient.invalidateQueries({ queryKey: ['spaces'] });
      void queryClient.invalidateQueries({ queryKey: ['space-context'] });
    });
  };

  // Determine if we should fetch data:
  // - For 'budgets' step: only if no existing budget categories data
  // - For 'accounts' step: only if no existing accounts data
  // - For other steps: always fetch if step is provided
  const shouldFetchData = !!api && !!step && isAuthenticated && (
    (step === 'currency') ||
    (step === 'budgets' && budgetCategories.length === 0) ||
    (step === 'accounts' && accountsData.length === 0) ||
    (step !== 'budgets' && step !== 'accounts')
  );

  // Fetch onboarding data query
  const {
    data: onboardingData,
    isLoading: isLoadingOnboarding,
    isError: isOnboardingError,
    error: onboardingError,
    refetch: refetchOnboarding
  } = useQuery({
    queryKey: ['onboarding', step],
    queryFn: () => getOnboardingData({ api, step: step! }),
    enabled: shouldFetchData,
  });

  useEffect(() => {
    if (!onboardingData) return;

    const response = onboardingData as any;

    if (step === 'budgets' && response?.data) {
      if (response.data.budgetsData) {
        setBudgetCategories(response.data.budgetsData);
        setOnboardingData((current) => ({
          ...current,
          incomeData: {
            income: response.data.incomeData.income,
          },
        }));
      }
    }

    if (step === 'accounts' && response?.data) {
      if (response.data.accountsData) {
        setAccountsData(response.data.accountsData);
      }
      if (response.data.accountCategories) {
        setAccountCategories(response.data.accountCategories);
      }
    }
  }, [
    onboardingData,
    step,
    setBudgetCategories,
    setOnboardingData,
    setAccountsData,
    setAccountCategories,
  ]);

  // Save currency step mutation
  const saveCurrencyStepMutation = useMutation({
    mutationFn: async (data: Omit<SaveCurrencyStepArgs, 'api'>) => {
      const response = await saveCurrencyStepData({ api, ...data });
      setOnboardingStep('income');
      setOnboardingData((current) => ({
        ...current,
        step: 'income',
        currency: data.currency.toUpperCase(),
      }));
      invalidateUserContext();
      invalidateWorkspaceLists();
      toast.success('Currency set successfully');
      return response;
    },
  });

  // Save step 1 data mutation
  const saveStep1Mutation = useMutation({
    mutationFn: async (data: Omit<SaveStep1DataArgs, 'api'>) => {
      try {
        const response: any = await saveStep1Data({ api, ...data });
        setOnboardingStep('budgets');
        invalidateUserContext();

        if (response?.data) {
          setBudgetCategories(response.data.budgetsData);
        }

        toast.success('Income information saved successfully');
        return response;
      } catch (error) {
        console.error('Error saving step 1 data:', error);
        throw error;
      }
    },
  });

  // Save step 2 data mutation
  const saveStep2Mutation = useMutation({
    mutationFn: async (data: Omit<SaveStep2DataArgs, 'api'>) => {
      try {
        const response: any = await saveStep2Data({ api, ...data });
        setOnboardingStep('accounts');
        invalidateUserContext();

        if (response?.data) {
          setAccountsData(response.data.accountsData);
          setAccountCategories(response.data.accountCategories);

          setIncomeRequirements({
            salaryIncome: !!response.data.salaryIncome,
            businessIncome: !!response.data.businessIncome,
          });
        }

        toast.success('Budget categories saved successfully');
        return response;
      } catch (error) {
        console.error('Error saving step 2 data:', error);
        throw error;
      }
    },
  });

  // Skip onboarding mutation
  const skipOnboardingMutation = useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries({ queryKey: ['currentUser'] });
      const previousStep = currentOnboardingStep;
      setOnboardingStep('completed');

      try {
        const response = await skipOnboardingSetup({ api });
        invalidateUserContext();
        return response;
      } catch (error) {
        console.error('Error skipping onboarding:', error);
        if (previousStep != null) {
          setOnboardingStep(previousStep);
        }
        void queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        throw error;
      }
    },
  });

  // Save step 3 data mutation
  const saveStep3Mutation = useMutation({
    mutationFn: async (data: Omit<SaveStep3DataArgs, 'api'>) => {
      try {
        const response = await saveStep3Data({ api, ...data });
        setOnboardingStep('import');
        invalidateUserContext();
        toast.success('Accounts setup completed successfully');
        return response;
      } catch (error) {
        console.error('Error saving step 3 data:', error);
        throw error;
      }
    },
  });

  return {
    // Query data
    onboardingData,
    isLoadingOnboarding,
    isOnboardingError,
    onboardingError,
    refetchOnboarding,

    // Mutations (async versions)
    saveCurrencyStepData: saveCurrencyStepMutation.mutateAsync,
    saveStep1Data: saveStep1Mutation.mutateAsync,
    saveStep2Data: saveStep2Mutation.mutateAsync,
    saveStep3Data: saveStep3Mutation.mutateAsync,
    skipOnboarding: skipOnboardingMutation.mutateAsync,
    isUpdating:
      saveCurrencyStepMutation.isPending ||
      saveStep1Mutation.isPending ||
      saveStep2Mutation.isPending ||
      saveStep3Mutation.isPending ||
      skipOnboardingMutation.isPending,

    // Mutation errors
    step1Error: saveStep1Mutation.error,
    step2Error: saveStep2Mutation.error,
    step3Error: saveStep3Mutation.error,

    // Mutation results
    step1Result: saveStep1Mutation.data,
    step2Result: saveStep2Mutation.data,
    step3Result: saveStep3Mutation.data,
  };
};
