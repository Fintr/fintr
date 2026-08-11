"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";

import { pendingOpenTransactionAtom } from "@/atoms/transactionEditAtoms";
import { OPEN_TRANSACTION_EVENT } from "@/lib/open-transaction-request";
import type { IndexTransaction } from "@/types/transactionTypes";

/**
 * Registers a global listener so realtime toasts can open a transaction
 * from any dashboard route.
 */
export const useOpenTransactionRequest = (): void => {
  const router = useRouter();
  const setPendingOpenTransaction = useSetAtom(pendingOpenTransactionAtom);

  useEffect(() => {
    const handleOpenTransaction = (event: Event) => {
      const customEvent = event as CustomEvent<{ transaction?: IndexTransaction }>;
      const transaction = customEvent.detail?.transaction;
      if (!transaction?.id) {
        return;
      }

      setPendingOpenTransaction(transaction);

      const path = window.location.pathname.replace(/\/$/, "") || "/";
      if (path !== "/dashboard") {
        router.push("/dashboard/");
      }
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
  }, [router, setPendingOpenTransaction]);
};
