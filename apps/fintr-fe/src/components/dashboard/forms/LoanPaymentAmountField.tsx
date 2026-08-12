"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "@/components/dashboard/forms/AmountWithRatePicker";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import {
  conversionSnapshotMatchesAmountCurrency,
  conversionSnapshotMatchesTarget,
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
} from "@/utils/amountPickerTargetCurrency";

export type LoanPaymentAmountFieldProps = {
  id: string;
  loanCurrency: string;
  spaceCurrency: string;
  accountName: string;
  accountOptions: AccountOptionWithCurrency[];
  amountDisplayValue: string;
  onAmountChange: (value: string) => void;
  paymentDate?: Date;
  formSubmitted: boolean;
  amountError?: string;
  initialConversion?: ConversionSnapshot | null;
  onConversionChange?: (conversion: ConversionSnapshot | null) => void;
  adjustsAccountBalance?: boolean;
};

export const LoanPaymentAmountField = ({
  id,
  loanCurrency,
  spaceCurrency,
  accountName,
  accountOptions,
  amountDisplayValue,
  onAmountChange,
  paymentDate,
  formSubmitted,
  amountError,
  initialConversion = null,
  onConversionChange,
  adjustsAccountBalance = true,
}: LoanPaymentAmountFieldProps) => {
  const [conversionSnapshot, setConversionSnapshot] =
    useState<ConversionSnapshot | null>(initialConversion);

  const selectedAccount = useMemo(
    () => accountOptions.find((option) => option.value === accountName),
    [accountName, accountOptions],
  );

  const amountPickerTargetCurrency = useMemo(
    () =>
      resolveAmountPickerTargetCurrency({
        amountCurrency: loanCurrency,
        accountLedgerCurrency: selectedAccount?.currency ?? null,
        editBookedCurrency: null,
        effectiveSpaceCurrency: spaceCurrency,
      }),
    [loanCurrency, selectedAccount?.currency, spaceCurrency],
  );

  const amountCurrencyOptions = useMemo(() => {
    const codes = new Set<string>([loanCurrency]);
    accountOptions.forEach((option) => {
      if (option.currency) {
        codes.add(option.currency);
      }
    });
    if (spaceCurrency) {
      codes.add(spaceCurrency);
    }
    return Array.from(codes);
  }, [accountOptions, loanCurrency, spaceCurrency]);

  useEffect(() => {
    setConversionSnapshot(initialConversion);
  }, [initialConversion]);

  useEffect(() => {
    if (!conversionSnapshot) {
      return;
    }

    const targetMismatch =
      amountPickerTargetCurrency != null &&
      !conversionSnapshotMatchesTarget(
        conversionSnapshot,
        amountPickerTargetCurrency,
      );
    const amountMismatch = !conversionSnapshotMatchesAmountCurrency(
      conversionSnapshot,
      loanCurrency,
    );

    if (targetMismatch || amountMismatch) {
      setConversionSnapshot(null);
      onConversionChange?.(null);
    }
  }, [
    amountPickerTargetCurrency,
    conversionSnapshot,
    loanCurrency,
    onConversionChange,
  ]);

  const handleConversionChange = (conversion: ConversionSnapshot | null) => {
    setConversionSnapshot(conversion);
    onConversionChange?.(conversion);
  };

  const needsConversion =
    adjustsAccountBalance &&
    createTransactionNeedsConversion({
      amountCurrency: loanCurrency,
      targetCurrency: amountPickerTargetCurrency,
    });

  const conversionRequiredError =
    formSubmitted && needsConversion && !conversionSnapshot
      ? "Exchange rate is required when the account currency differs from the loan"
      : undefined;

  return (
    <AmountWithRatePicker
      id={id}
      label="Total Payment Amount"
      amountDisplayValue={amountDisplayValue}
      onAmountChange={onAmountChange}
      fromCurrency={loanCurrency}
      onFromCurrencyChange={() => undefined}
      toCurrency={amountPickerTargetCurrency}
      amountCurrencyOptions={amountCurrencyOptions}
      accountOptions={accountOptions}
      errors={
        formSubmitted && (amountError || conversionRequiredError)
          ? [amountError, conversionRequiredError].filter(
              (message): message is string => Boolean(message),
            )
          : []
      }
      placeholder="0.00"
      inputClassName={
        formSubmitted && (amountError || conversionRequiredError)
          ? "border-red-800 focus-visible:ring-red-800"
          : ""
      }
      lockFromCurrency
      hideRatePicker={!needsConversion}
      onConversionChange={handleConversionChange}
      date={
        paymentDate
          ? paymentDate.toISOString().slice(0, 10)
          : undefined
      }
      initialConversion={initialConversion ?? undefined}
    />
  );
};

export const buildLoanPaymentFxPayload = (
  conversionSnapshot: ConversionSnapshot | null,
  needsConversion: boolean,
): {
  originalCurrency?: string;
  exchangeRate?: number;
  exchangeRateSource?: "auto" | "manual" | "recent";
} => {
  if (!needsConversion || !conversionSnapshot) {
    return {};
  }

  return {
    originalCurrency: conversionSnapshot.originalCurrency,
    exchangeRate: conversionSnapshot.exchangeRate,
    exchangeRateSource: conversionSnapshot.exchangeRateSource,
  };
};
