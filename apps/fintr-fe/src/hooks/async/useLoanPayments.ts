import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  fetchLoanPayments,
  updateLoanPayment,
  CreateLoanPaymentType,
  LoanPayment,
} from "@/services/loans/payments";
import { createLoanPaymentLocalFirst } from "@/services/loans/payments/create-local-first";
import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { ACCOUNT_DETAIL_TRANSACTIONS_KEY } from "@/hooks/async/useAccountDetailTransactions";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";
import {
  removeLoanPaymentFromLocalStores,
  syncLoanPaymentsToLocalStores,
} from "@/services/loans/loan-payments-cache";
import { loanPaymentToIndexRow } from "@/services/loans/loan-payment-index-row";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { loadCachedLoanPayments } from "@/services/loans/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import type { Loan } from "@/services/loans/queries";
import {
  normalizeLoanPayment,
  normalizeLoanPayments,
} from "@/utils/loan-payment-amounts";

const seedPaymentsFromLoanDetail = (
  loanId: string,
  loan?: Loan | null,
): LoanPayment[] | undefined => {
  if (!loan?.loanPayments?.length) {
    return undefined;
  }

  return normalizeLoanPayments(
    loan.loanPayments.map((payment) => ({
      ...payment,
      loanId,
    })),
  );
};

export const useLoanPayments = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const invalidateLoanPaymentQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["loanPayments", loanId] });
    await queryClient.invalidateQueries({ queryKey: ["loans"] });
    await queryClient.invalidateQueries({ queryKey: [LOAN_DETAIL_KEY, loanId] });
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY],
      exact: false,
    });
  };

  const localPaymentsQuery = useQuery({
    queryKey: ["loanPayments", "local", spaceCode, loanId],
    queryFn: async () =>
      (await loadCachedLoanPayments(spaceCode, loanId)) ?? null,
    enabled: Boolean(spaceCode && loanId),
    staleTime: Infinity,
  });

  const loanDetailFromCache = queryClient.getQueryData<Loan>([
    LOAN_DETAIL_KEY,
    loanId,
  ]);
  const seedFromLoanDetail = seedPaymentsFromLoanDetail(
    loanId,
    loanDetailFromCache,
  );
  const placeholderPayments =
    localPaymentsQuery.data ?? seedFromLoanDetail ?? undefined;

  const skipNetworkFetch = useSkipCachedNetworkFetch(localPaymentsQuery);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LoanPayment[]>({
    queryKey: ["loanPayments", loanId],
    queryFn: async () => {
      const payments = await fetchLoanPayments(api, loanId);
      await syncLoanPaymentsToLocalStores({
        spaceCode,
        loanId,
        payments,
        queryClient,
      });
      return payments;
    },
    enabled: Boolean(loanId && api && !skipNetworkFetch),
    placeholderData: placeholderPayments,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    gcTime: 300000,
  });

  const payments = data ?? placeholderPayments ?? [];

  const createMutation = useMutation({
    mutationFn: async (
      paymentData: Omit<CreateLoanPaymentType, "loanId">,
    ) => {
      const loanCurrency =
        loanDetailFromCache?.principalAmountCurrency ??
        loanDetailFromCache?.outstandingBalanceCurrency ??
        "PHP";

      const result = await createLoanPaymentLocalFirst(
        api,
        {
          spaceId: spaceCode,
          loanId,
          data: paymentData,
        },
        {
          queryClient,
          waitForSync: false,
          currency: loanCurrency,
        },
      );

      void Promise.resolve(result.syncPromise)
        .then(async (synced) => {
          if (synced.pendingSync) {
            return;
          }
          await invalidateLoanPaymentQueries();
        })
        .catch(() => undefined);

      return result;
    },
  });

  const updateMutation = useMutation({
    onMutate: async ({
      paymentId,
      paymentData,
    }: {
      paymentId: string;
      paymentData: Partial<Omit<CreateLoanPaymentType, "loanId">>;
    }) => {
      await queryClient.cancelQueries({ queryKey: ["loanPayments", loanId] });

      const previousPayments =
        queryClient.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ??
        payments;

      const nextPayments = previousPayments.map((payment) => {
        if (payment.id !== paymentId) {
          return payment;
        }

        return {
          ...payment,
          ...(paymentData.accountName
            ? { accountName: paymentData.accountName }
            : {}),
          ...(paymentData.date ? { date: paymentData.date } : {}),
          ...(paymentData.totalPayment !== undefined
            ? {
                totalPayment: paymentData.totalPayment,
                principalPayment:
                  paymentData.principalPayment ?? paymentData.totalPayment,
              }
            : {}),
          ...(paymentData.notes !== undefined
            ? { notes: paymentData.notes }
            : {}),
          ...(paymentData.adjustsAccountBalance !== undefined
            ? { adjustsAccountBalance: paymentData.adjustsAccountBalance }
            : {}),
        };
      });

      await syncLoanPaymentsToLocalStores({
        spaceCode,
        loanId,
        payments: nextPayments,
        queryClient,
      });

      return { previousPayments };
    },
    mutationFn: async ({
      paymentId,
      paymentData,
    }: {
      paymentId: string;
      paymentData: Partial<Omit<CreateLoanPaymentType, "loanId">>;
    }) => {
      const result = await updateLoanPayment(
        api,
        loanId,
        paymentId,
        paymentData,
      );
      const updated = normalizeLoanPayment(
        (result as { data?: unknown })?.data ?? result,
      );

      if (updated) {
        const current =
          queryClient.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ??
          [];
        const nextPayments = current.map((payment) =>
          payment.id === paymentId ? updated : payment,
        );
        await syncLoanPaymentsToLocalStores({
          spaceCode,
          loanId,
          payments: nextPayments,
          queryClient,
        });
      }

      void invalidateLoanPaymentQueries();
      return result;
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPayments) {
        void syncLoanPaymentsToLocalStores({
          spaceCode,
          loanId,
          payments: context.previousPayments,
          queryClient,
        });
      }
    },
  });

  const deleteMutation = useMutation({
    onMutate: async (paymentId: string) => {
      await queryClient.cancelQueries({ queryKey: ["loanPayments", loanId] });

      const previousPayments =
        queryClient.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ??
        payments;

      await removeLoanPaymentFromLocalStores({
        spaceCode,
        loanId,
        paymentId,
        queryClient,
      });

      return { previousPayments };
    },
    mutationFn: async (paymentId: string) => {
      const cachedPayments =
        queryClient.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ??
        [];
      const payment =
        cachedPayments.find((row) => row.id === paymentId) ??
        payments.find((row) => row.id === paymentId);

      const listRow = payment
        ? loanPaymentToIndexRow(payment, loanId)
        : {
            id: paymentId,
            date: "",
            description: "Loan payment",
            amount: 0,
            categoryName: "Loan payment",
            fromAccountName: "",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
            inSeries: false,
            hasImage: false,
            calculated: true,
            isLoanActivity: true,
            loanId,
          };

      const result = await deleteTransactionLocalFirst(
        api,
        {
          spaceId: spaceCode,
          transactionId: paymentId,
          deleteScope: DeleteScopeEnum.THIS_ONLY,
          listRow,
        },
        { queryClient, waitForSync: false },
      );

      void Promise.resolve(result.syncPromise)
        .then(async (synced) => {
          if (synced.pendingSync) {
            return;
          }
          await invalidateLoanPaymentQueries();
        })
        .catch(() => undefined);

      return result;
    },
    onError: (_error, _paymentId, context) => {
      if (context?.previousPayments) {
        void syncLoanPaymentsToLocalStores({
          spaceCode,
          loanId,
          payments: context.previousPayments,
          queryClient,
        });
      }
    },
  });

  return {
    payments,
    isLoading: isLoading && payments.length === 0,
    isError,
    error,
    refetch,
    createPayment: createMutation.mutateAsync,
    updatePayment: updateMutation.mutateAsync,
    deletePayment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
