import { format } from "date-fns";
import { useRef } from "react";

import type { ConversionSnapshot } from "@/components/dashboard/forms/AmountWithRatePicker";
import { isUploadableFile } from "@/utils/formUtils";
import { isExistingCachedAttachment } from "@/utils/fileUtils";
import { positiveTransactionFormAmount } from "@/utils/transactionFormAmount";

export const dateDirtySignature = (date: Date | undefined): string => {
  if (!date) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
};

export const amountDirtySignature = (value: unknown): string => {
  return String(positiveTransactionFormAmount(value));
};

export const tagIdsDirtySignature = (ids: string[]): string => {
  return [...ids].sort().join(",");
};

export const fileDirtySignature = (file: File | null | undefined): string => {
  if (!file) {
    return "";
  }

  return `${file.name}:${file.size}:${file.lastModified}`;
};

export const nextAttachmentBaselineSignature = ({
  transactionId,
  previousTransactionId,
  previousBaseline,
  incomingFile,
}: {
  transactionId?: string;
  previousTransactionId?: string;
  previousBaseline: string;
  incomingFile: File | null | undefined;
}): string => {
  if (transactionId !== previousTransactionId) {
    return fileDirtySignature(incomingFile);
  }

  if (!incomingFile) {
    return previousBaseline;
  }

  if (isUploadableFile(incomingFile) && !isExistingCachedAttachment(incomingFile)) {
    return previousBaseline;
  }

  return fileDirtySignature(incomingFile);
};

export const useAttachmentDirtyBaseline = (
  transactionId: string | undefined,
  incomingFile: File | null | undefined,
): string => {
  const previous = useRef({
    transactionId,
    signature: fileDirtySignature(incomingFile),
  });

  const signature = nextAttachmentBaselineSignature({
    transactionId,
    previousTransactionId: previous.current.transactionId,
    previousBaseline: previous.current.signature,
    incomingFile,
  });

  previous.current = { transactionId, signature };

  return signature;
};

export const conversionDirtySignature = (
  conversion: ConversionSnapshot | null | undefined,
): string => {
  if (!conversion) {
    return "";
  }

  return [
    conversion.originalCurrency,
    conversion.targetCurrency,
    Number(conversion.exchangeRate).toFixed(6),
    conversion.exchangeRateSource,
  ].join("|");
};

export const isEditSnapshotDirty = (
  enabled: boolean,
  current: Record<string, string>,
  baseline: Record<string, string>,
): boolean => {
  if (!enabled) {
    return false;
  }

  return JSON.stringify(current) !== JSON.stringify(baseline);
};
