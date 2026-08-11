import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { DeleteScopeEnum } from "@/constants/transactionConstants";
import {
  removeLoanFromCachedPages,
} from "@/services/loans/local-cache";
import { loanToIndexRow } from "@/services/loans/loan-to-index-row";
import { removeLoanFromQueryCaches } from "@/services/loans/loans-list-cache";
import {
  deleteTransactionLocalFirst,
  type DeleteTransactionLocalFirstResult,
} from "@/services/transactions/delete-local-first";

import type { Loan } from "./queries";

export type DeleteLoanLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

/**
 * Local-first loan delete: loans list + transaction index immediately,
 * IndexedDB + outbox, then DELETE on the server.
 */
export const deleteLoanLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    loan: Loan;
  },
  options: DeleteLoanLocalFirstOptions = {},
): Promise<DeleteTransactionLocalFirstResult> => {
  const { spaceId, loan } = params;
  const { queryClient, waitForSync = false } = options;

  if (queryClient) {
    removeLoanFromQueryCaches(queryClient, loan.id);
  }
  void removeLoanFromCachedPages(spaceId, loan.id);

  return deleteTransactionLocalFirst(
    api,
    {
      spaceId,
      transactionId: loan.id,
      deleteScope: DeleteScopeEnum.THIS_ONLY,
      listRow: loanToIndexRow(loan),
    },
    { queryClient, waitForSync },
  );
};
