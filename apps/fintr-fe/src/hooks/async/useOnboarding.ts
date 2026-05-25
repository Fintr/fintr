import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
  const [onboardingDataFromAtom, setOnboardingData] = useAtom(onboardingDataAtom);
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
    onSuccess: (response: any) => {
      // If we're on the budgets step and response contains budget data, populate the atom
      console.log('budgets', response.data)
      if (step === 'budgets' && response && response.data) {
        if (response.data.budgetsData) {
          setBudgetCategories(response.data.budgetsData);
          setOnboardingData({...onboardingDataFromAtom, incomeData: {
            income: response.data.incomeData.income,
          }})
          console.log('onboardingDataFromAtom', onboardingDataFromAtom)
        }
      }
      // If we're on the accounts step and response contains account data, populate the atoms
      if (step === 'accounts' && response && response.data) {
        if (response.data.accountsData) {
          setAccountsData(response.data.accountsData);
        }
        if (response.data.accountCategories) {
          setAccountCategories(response.data.accountCategories);
        }
      }
    },
  });

  // Save currency step mutation
  const saveCurrencyStepMutation = useMutation({
    mutationFn: (data: Omit<SaveCurrencyStepArgs, 'api'>) =>
      saveCurrencyStepData({ api, ...data }),
    onSuccess: (_response, variables) => {
      setOnboardingStep('income');
      setOnboardingData((current) => ({
        ...current,
        step: 'income',
        currency: variables.currency.toUpperCase(),
      }));
      invalidateUserContext();
      invalidateWorkspaceLists();
      toast.success('Currency set successfully');
    },
    onError: (error: any) => {
      console.error('Error saving currency step:', error);
    },
  });

  // Save step 1 data mutation
  const saveStep1Mutation = useMutation({
    mutationFn: (data: Omit<SaveStep1DataArgs, 'api'>) => 
      saveStep1Data({ api, ...data }),
    onSuccess: (response: any) => {
      setOnboardingStep('budgets');
      invalidateUserContext();

      if (response && response.data) {
        setBudgetCategories(response.data.budgetsData);
      }
      
      toast.success('Income information saved successfully');
    },
    onError: (error: any) => {
      console.error('Error saving step 1 data:', error);
      // Don't show toast here - let the calling component handle it
    },
  });

  // Save step 2 data mutation
  const saveStep2Mutation = useMutation({
    mutationFn: (data: Omit<SaveStep2DataArgs, 'api'>) => 
      saveStep2Data({ api, ...data }),
    onSuccess: (response: any) => {
      setOnboardingStep('accounts');
      invalidateUserContext();

      if (response && response.data) {
        setAccountsData(response.data.accountsData)
        setAccountCategories(response.data.accountCategories)
        
        // Update income requirements from the response
        setIncomeRequirements({
          salaryIncome: !!response.data.salaryIncome,
          businessIncome: !!response.data.businessIncome
        });
      }
      
      toast.success('Budget categories saved successfully');
    },
    onError: (error: any) => {
      console.error('Error saving step 2 data:', error);
      // Don't show toast here - let the calling component handle it
    },
  });

  // Skip onboarding mutation
  const skipOnboardingMutation = useMutation({
    mutationFn: () => skipOnboardingSetup({ api }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['currentUser'] });
      const previousStep = currentOnboardingStep;
      setOnboardingStep('completed');
      return { previousStep };
    },
    onSuccess: () => {
      setOnboardingStep('completed');
      invalidateUserContext();
    },
    onError: (error: any, _variables, context) => {
      console.error('Error skipping onboarding:', error);
      if (context?.previousStep != null) {
        setOnboardingStep(context.previousStep);
      }
      void queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  // Save step 3 data mutation
  const saveStep3Mutation = useMutation({
    mutationFn: (data: Omit<SaveStep3DataArgs, 'api'>) => 
      saveStep3Data({ api, ...data }),
    onSuccess: () => {
      setOnboardingStep('import');
      invalidateUserContext();
      
      toast.success('Accounts setup completed successfully');
    },
    onError: (error: any) => {
      console.error('Error saving step 3 data:', error);
      // Don't show toast here - let the calling component handle it
    },
  });

  const saveCurrencyStepDataAsync = (data: Omit<SaveCurrencyStepArgs, 'api'>) => {
    return new Promise((resolve, reject) => {
      saveCurrencyStepMutation.mutate(data, {
        onSuccess: (result) => resolve(result),
        onError: (error) => reject(error),
      });
    });
  };

  // Create async wrapper functions
  const saveStep1DataAsync = (data: Omit<SaveStep1DataArgs, 'api'>) => {
    return new Promise((resolve, reject) => {
      saveStep1Mutation.mutate(data, {
        onSuccess: (result) => resolve(result),
        onError: (error) => reject(error)
      });
    });
  };

  const saveStep2DataAsync = (data: Omit<SaveStep2DataArgs, 'api'>) => {
    return new Promise((resolve, reject) => {
      saveStep2Mutation.mutate(data, {
        onSuccess: (result) => resolve(result),
        onError: (error) => reject(error)
      });
    });
  };

  const saveStep3DataAsync = (data: Omit<SaveStep3DataArgs, 'api'>) => {
    return new Promise((resolve, reject) => {
      saveStep3Mutation.mutate(data, {
        onSuccess: (result) => resolve(result),
        onError: (error) => reject(error),
      });
    });
  };

  const skipOnboardingAsync = () => {
    return new Promise((resolve, reject) => {
      skipOnboardingMutation.mutate(undefined, {
        onSuccess: (result) => resolve(result),
        onError: (error) => reject(error),
      });
    });
  };

  return {
    // Query data
    onboardingData,
    isLoadingOnboarding,
    isOnboardingError,
    onboardingError,
    refetchOnboarding,
    
    // Mutations (async versions)
    saveCurrencyStepData: saveCurrencyStepDataAsync,
    saveStep1Data: saveStep1DataAsync,
    saveStep2Data: saveStep2DataAsync,
    saveStep3Data: saveStep3DataAsync,
    skipOnboarding: skipOnboardingAsync,
    isUpdating:
      saveCurrencyStepMutation.isLoading ||
      saveStep1Mutation.isLoading ||
      saveStep2Mutation.isLoading ||
      saveStep3Mutation.isLoading ||
      skipOnboardingMutation.isLoading,
    
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
