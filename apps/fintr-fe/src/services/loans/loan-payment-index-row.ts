import type { CreateLoanPaymentType, LoanPayment } from "@/services/loans/payments";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const optimisticLoanPaymentIndexMoney = (params: {
  payment: Pick<LoanPayment, "totalPayment" | "currency" | "currencyConversion">;
  spaceCurrency: string;
  createData?: Pick<CreateLoanPaymentType, "originalCurrency" | "exchangeRate">;
}): Pick<
  IndexTransaction,
  "amount" | "amountCurrency" | "bookedAmount" | "bookedAmountCurrency"
> => {
  const { payment, spaceCurrency, createData } = params;
  const loanCurrency = payment.currency;
  const originalAmount = payment.totalPayment;
  const conversion = payment.currencyConversion;

  const originalCurrency =
    createData?.originalCurrency?.trim() ||
    conversion?.originalCurrency?.trim() ||
    loanCurrency;
  const exchangeRate = createData?.exchangeRate ?? conversion?.exchangeRate;
  const convertedCurrency =
    conversion?.convertedCurrency?.trim() || spaceCurrency;

  if (
    originalCurrency &&
    exchangeRate != null &&
    Number.isFinite(Number(exchangeRate)) &&
    Number(exchangeRate) > 0 &&
    originalCurrency.toUpperCase() !== convertedCurrency.toUpperCase()
  ) {
    const convertedAmount =
      conversion?.convertedAmount != null && conversion.convertedAmount > 0
        ? conversion.convertedAmount
        : roundMoney(originalAmount * Number(exchangeRate));

    return {
      amount: roundMoney(convertedAmount),
      amountCurrency: convertedCurrency,
      bookedAmount: originalAmount,
      bookedAmountCurrency: originalCurrency,
    };
  }

  return {
    amount: originalAmount,
    amountCurrency: loanCurrency,
  };
};

export const loanPaymentToIndexRow = (
  payment: LoanPayment,
  loanId: string,
  options?: {
    spaceCurrency?: string;
    createData?: Pick<CreateLoanPaymentType, "originalCurrency" | "exchangeRate">;
  },
): IndexTransaction => ({
  id: payment.id,
  date: payment.date,
  description: payment.notes?.trim() || "Loan payment",
  ...optimisticLoanPaymentIndexMoney({
    payment,
    spaceCurrency: options?.spaceCurrency ?? payment.currency,
    createData: options?.createData,
  }),
  categoryName: "Loan payment",
  fromAccountName: payment.accountName,
  toAccountName: "",
  type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
  inSeries: false,
  hasImage: false,
  calculated: true,
  isLoanActivity: true,
  loanId,
});
