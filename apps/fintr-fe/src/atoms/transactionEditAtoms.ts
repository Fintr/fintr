import { atom } from "jotai";

import type { IndexTransaction } from "@/types/transactionTypes";

/** Set by realtime toasts; consumed by the transactions tab to open edit. */
export const pendingOpenTransactionAtom = atom<IndexTransaction | null>(null);
