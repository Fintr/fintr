/** Matches receipt processing limit (apps/fintr-be/docs/receipt_processing.md). */
export const MAX_ATTACHMENT_BYTE_SIZE = 10 * 1024 * 1024;

/** Per-space IndexedDB attachment budget (phase 1 guardrail). */
export const MAX_ATTACHMENT_SPACE_BYTE_SIZE = 200 * 1024 * 1024;

export const DEFAULT_ATTACHMENT_ID = "0";
