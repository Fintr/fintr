"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OPEN_TRANSACTION_EVENT } from "@/lib/open-transaction-request";
import type { IndexTransaction } from "@/types/transactionTypes";
import { transactionViewHref } from "@/utils/detailHrefs";

/**
 * Registers a global listener so realtime toasts can open a transaction
 * from any dashboard route.
 */
export const useOpenTransactionRequest = (): void => {
  const router = useRouter();

  useEffect(() => {
    const handleOpenTransaction = (event: Event) => {
      const customEvent = event as CustomEvent<{ transaction?: IndexTransaction }>;
      const transaction = customEvent.detail?.transaction;
      if (!transaction?.id) {
        return;
      }

      router.push(transactionViewHref(transaction));
    };

    window.addEventListener(
      OPEN_TRANSACTION_EVENT,
      handleOpenTransaction as EventListener,
    );

    return () => {
      window.removeEventListener(
        OPEN_TRANSACTION_EVENT,
        handleOpenTransaction as EventListener,
      );
    };
  }, [router]);
};
