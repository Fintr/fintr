import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import { CustomModal } from "@/components/ui/custom-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExpenseForm from "@/components/dashboard/forms/ExpenseForm";
import IncomeForm from "@/components/dashboard/forms/IncomeForm";
import TransferForm from "@/components/dashboard/forms/TransferForm";
import LoanForm from "@/components/dashboard/forms/LoanForm";
import GoalForm from "@/components/dashboard/forms/GoalForm";
import InvestmentForm from "@/components/dashboard/forms/InvestmentForm";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { X } from "lucide-react";
import {
  UpdateTransactionType,
  CombinedTransactionTypeEnum,
} from "@/types/transactionTypes";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { shouldShowV2Features } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { ACCOUNT_DETAIL_TRANSACTIONS_KEY } from "@/hooks/async/useAccountDetailTransactions";

interface AddTransactionDialogProps {
  onAddTransaction?: (transaction: any) => void;
  // New props for controlled mode
  isOpen?: boolean;
  onClose?: () => void;
  initialTransactionType?: 'expense' | 'income' | 'transfer' | 'loan' | 'investment' | 'goal';
  prefilledData?: {
    type?: 'expense' | 'income' | 'transfer' | 'loan' | 'investment' | 'goal';
    amount?: number;
    description?: string;
    categoryName?: string;
    accountName?: string;
    date?: string;
    scheduleType?: string;
    receiptImage?: File;
    draftId?: string;
    entityName?: string;
    receiptMerchantDetected?: string;
  };
}

const AddTransactionDialog = ({
  onAddTransaction = () => {},
  isOpen: controlledOpen,
  onClose: controlledOnClose,
  initialTransactionType,
  prefilledData,
}: AddTransactionDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState(initialTransactionType || "expense");
  const [sharedAmount, setSharedAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const defaultTransactionCurrency = currentSpace?.defaultTransactionCurrency ?? null;

  // Use controlled or internal open state
  const isDialogOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setDialogOpen = controlledOnClose !== undefined ? 
    (open: boolean) => !open && controlledOnClose() : setInternalOpen;

  // Memoize initialData for ExpenseForm to prevent infinite re-renders
  // Apply OCR data to ALL forms - user chooses which tab to use
  const expenseInitialData = useMemo(() => {
    if (prefilledData) {
      return {
        id: '',
        date: prefilledData.date || format(new Date(), 'yyyy-MM-dd'),
        transactionType: 'expense' as const,
        type: CombinedTransactionTypeEnum.EXPENSE,
        amount: prefilledData.amount || 0,
        description: prefilledData.description || '',
        categoryName: prefilledData.categoryName || '',
        accountName: prefilledData.accountName || '',
        scheduleType: prefilledData.scheduleType as any || 'one_time',
        repeatInterval: '',
        installmentPeriod: 0,
        file: prefilledData.receiptImage || null,
        draftId: prefilledData.draftId,
        entityName: prefilledData.entityName || '',
        receiptMerchantDetected: prefilledData.receiptMerchantDetected,
      };
    }
    return undefined;
  }, [prefilledData]);

  // Memoize initialData for IncomeForm
  // Apply OCR data to ALL forms - user chooses which tab to use
  const incomeInitialData = useMemo(() => {
    if (prefilledData) {
      return {
        id: '',
        date: prefilledData.date || format(new Date(), 'yyyy-MM-dd'),
        transactionType: 'income' as const,
        type: CombinedTransactionTypeEnum.INCOME,
        amount: prefilledData.amount || 0,
        description: prefilledData.description || '',
        categoryName: prefilledData.categoryName || '',
        accountName: prefilledData.accountName || '',
        scheduleType: prefilledData.scheduleType as any || 'one_time',
        repeatInterval: '',
        installmentPeriod: 0,
        file: prefilledData.receiptImage || null,
        draftId: prefilledData.draftId,
      };
    }
    return undefined;
  }, [prefilledData]);

  // Memoize initialData for TransferForm
  // Apply OCR data to ALL forms - user chooses which tab to use
  const transferInitialData = useMemo(() => {
    if (prefilledData) {
      return {
        id: '',
        date: prefilledData.date || format(new Date(), 'yyyy-MM-dd'),
        amount: prefilledData.amount || 0,
        transactionCost: 0,
        description: prefilledData.description || '',
        fromAccountName: prefilledData.accountName || '',
        toAccountName: '',
        scheduleType: prefilledData.scheduleType as any || 'one_time',
        repeatInterval: '',
        file: prefilledData.receiptImage || undefined,
        draftId: prefilledData.draftId,
      };
    }
    return undefined;
  }, [prefilledData]);

  // Store AI-suggested date separately (don't automatically apply it)
  const suggestedDate = useMemo(() => {
    if (prefilledData?.date) {
      const suggested = new Date(prefilledData.date);
      const today = new Date();
      // Only return if it's different from today
      if (suggested.toDateString() !== today.toDateString()) {
        return suggested;
      }
    }
    return undefined;
  }, [prefilledData?.date]);

  // Set initial date when dialog opens
  // Always use today's date, never the AI-suggested date
  // User manually chooses which tab (expense/income/transfer) to use
  useEffect(() => {
    if (isDialogOpen) {
      setDate(new Date());
      if (prefilledData?.amount) {
        setSharedAmount(String(prefilledData.amount));
      }
      if (initialTransactionType) {
        setActiveTab(initialTransactionType);
      }
      return;
    }

    setSharedAmount("");
    setActiveTab("expense");
  }, [isDialogOpen]);

  // Ensure TabsList scrolls to left-most on dialog open
  useEffect(() => {
    if (isDialogOpen && tabsListRef.current) {
      tabsListRef.current.scrollLeft = 0;
    }
  }, [isDialogOpen]);

  // Get access to React Query client for cache invalidation
  const queryClient = useQueryClient();

  // Create form refs for each form type
  const expenseFormRef = useRef<HTMLFormElement | null>(null);

  // Form state for goal
  const [goalForm, setGoalForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    targetDate: new Date(),
    receipt: null as File | null,
    monthlyContribution: "",
    priority: "",
  });

  // Form state for loan
  const [loanForm, setLoanForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    receipt: null as File | null,
    loanDate: new Date(),
    dueDate: new Date(),
    interestRate: "",
    loanType: "",
  });

  // Form state for transfer
  const [transferForm, setTransferForm] = useState({
    amount: "",
    fromAccount: "",
    toAccount: "",
    description: "",
    receipt: null as File | null,
  });

  // Form state for income
  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    description: "",
    category: "",
    account: "",
    scheduleType: ScheduleTypeEnum.ONE_TIME,
    repeatInterval: "",
    installmentPeriod: "",
    receipt: null as File | null,
  });

  // State for custom category input
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Determine which form to submit based on activeTab
    let submitFunction: (() => Promise<any>) | null = null;

    switch (activeTab) {
      case "expense":
        if (expenseFormRef.current) {
          submitFunction = () => {
            // Directly call the onSubmit handler of the ExpenseForm through its ref
            const event = new Event('submit', { cancelable: true });
            expenseFormRef.current?.dispatchEvent(event);
            return Promise.resolve(); // ExpenseForm handles its own submission
          };
        }
        break;
      // Add other cases for income, transfer, loan, investment, goal forms
      default:
        toast.error("Unsupported transaction type");
        setIsSubmitting(false);
        return;
    }

    if (submitFunction) {
      try {
        await submitFunction();
        // The individual forms handle onSubmitSuccess/Error via props
      } catch (error) {
        console.error("Submission error in dialog:", error);
        // Error handling should already be in individual forms, but as a fallback:
        toast.error("Failed to submit transaction. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }
  };

  const onTransactionSuccess = (response: any) => {
    const isOptimisticCreate = Boolean(
      response?.localTransaction && response?.syncPromise,
    );

    const refreshSecondaryCaches = () => {
      // Also invalidate loans query if we're on the loan tab
      if (activeTab === "loan") {
        queryClient.invalidateQueries({
          queryKey: ["loans"],
          refetchType: "active",
        });
      }
      // Invalidate accounts when any transaction/transfer/loan is created or updated
      queryClient.invalidateQueries({
        queryKey: ["accounts"],
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
        refetchType: "active",
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY],
        refetchType: "active",
        exact: false,
      });

      // Invalidate dashboard query to refresh financial summary
      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });
      // Invalidate insights query so Insights tab reflects latest stats
      queryClient.invalidateQueries({
        queryKey: ["insights"],
        refetchType: "active",
        exact: false,
      });
    };

    if (isOptimisticCreate) {
      // List + monthly totals already patched; avoid refetch racing the local: id.
      void Promise.resolve(response.syncPromise)
        .then(() => {
          refreshSecondaryCaches();
        })
        .catch(() => {
          // Form already toasts validation rollback; secondary caches unchanged.
        });
    } else {
      // Use specific invalidation targeting the exact query being used
      // This prevents duplicate data issues by being more precise
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "active", // Only refetch currently active/mounted queries
        exact: false, // Allow partial matches for any transactions query
      });
      refreshSecondaryCaches();
    }

    // Call the callback if provided
    onAddTransaction(response);

    // Redirect to loans page if a loan was created
    if (activeTab === "loan") {
      setDialogOpen(false);
      setTimeout(() => {
        router.push("/dashboard/loans");
      }, 100);
    } else {
      setDialogOpen(false);
    }
  };

  const onTransactionError = () => {
    toast.error("Failed to add transaction. Please try again.");
  };

  // Function to prepare and submit transaction based on type
  const prepareAndSubmitTransaction = (type: string) => {
    // This function is less relevant now that each form handles its own submission
    // but keeping it as a placeholder if future logic requires it.
  };

  // Reset forms on dialog close
  const resetForms = () => {
    // Reset all form states
    setDate(new Date());
    setActiveTab("expense");
    // Reset other form states here if they are directly managed by AddTransactionDialog
    // e.g., setInvestmentForm, setGoalForm, etc.
    setCustomExpenseCategories([]);
    setCustomIncomeCategories([]);
  };

  // Handle file upload for various forms (if needed)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (formType === "investment") {
        // setInvestmentForm((prev) => ({ ...prev, receipt: file })); // This state is removed
      } else if (formType === "goal") {
        setGoalForm((prev) => ({ ...prev, receipt: file }));
      } else if (formType === "loan") {
        setLoanForm((prev) => ({ ...prev, receipt: file }));
      } else if (formType === "transfer") {
        setTransferForm((prev) => ({ ...prev, receipt: file }));
      } else if (formType === "income") {
        setIncomeForm((prev) => ({ ...prev, receipt: file }));
      }
    }
  };

  // Handle custom account creation
  const handleAddCustomAccount = (accountName: string) => {
    // This is handled by the atom now, but keeping for consistency if needed.
    return accountName;
  };

  const tabOptions = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
    { value: "loan", label: "Loan" },
    { value: "investment", label: "Investment" },
    { value: "goal", label: "Goal" },
  ];

  const getMobileTabClass = (tab: string) =>
    `flex-1 min-w-[120px] text-sm shrink-0 rounded px-3 py-2 font-medium transition-colors border ${
      activeTab === tab
        ? "bg-primary text-white border-primary"
        : "bg-white text-primary border-primary hover:bg-primary/90 hover:text-white"
    } focus:outline-none`;

  const showV2Features = shouldShowV2Features();
  const titleId = useId();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const handleClose = () => {
    setDialogOpen(false);
  };

  const formContent = (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="flex min-h-0 w-full flex-1 flex-col gap-0"
    >
      <div className="shrink-0 px-6">
        <TabsList className="mb-4 grid w-full grid-cols-4 bg-white dark:bg-card dark:shadow-sm">
          <TabsTrigger value="expense" data-tutorial-target="expense-tab">Expense</TabsTrigger>
          <TabsTrigger value="income" data-tutorial-target="income-tab">Income</TabsTrigger>
          <TabsTrigger value="transfer" data-tutorial-target="transfer-tab">Transfer</TabsTrigger>
          <TabsTrigger value="loan" data-tutorial-target="loan-tab">Loan</TabsTrigger>
        </TabsList>

        {showV2Features && (
          <>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="investment">Investment</TabsTrigger>
            </TabsList>

            <TabsList className="mb-4 grid w-full grid-cols-1">
              <TabsTrigger value="goal">Goal</TabsTrigger>
            </TabsList>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "expense" && (
          <ExpenseForm
            date={date}
            setDate={setDate}
            suggestedDate={suggestedDate}
            spaceCurrency={spaceCurrency}
            defaultTransactionCurrency={defaultTransactionCurrency}
            prefillAmount={sharedAmount}
            onPrefillAmountChange={setSharedAmount}
            onAddCustomCategory={(category) => {
              setCustomExpenseCategories([
                ...customExpenseCategories,
                category,
              ]);
              return category;
            }}
            onAddCustomAccount={handleAddCustomAccount}
            onSubmitSuccess={(data) => onTransactionSuccess(data)}
            onCancel={handleClose}
            initialData={expenseInitialData}
            key={JSON.stringify(expenseInitialData?.file?.name || 'no-file')}
          />
        )}

        {activeTab === "income" && (
          <IncomeForm
            date={date}
            setDate={setDate}
            spaceCurrency={spaceCurrency}
            defaultTransactionCurrency={defaultTransactionCurrency}
            prefillAmount={sharedAmount}
            onPrefillAmountChange={setSharedAmount}
            onAddCustomCategory={(category) => {
              setCustomIncomeCategories([
                ...customIncomeCategories,
                category,
              ]);
              return category;
            }}
            onAddCustomAccount={handleAddCustomAccount}
            onSubmitSuccess={onTransactionSuccess}
            onCancel={handleClose}
            initialData={incomeInitialData}
            key={JSON.stringify(incomeInitialData?.file?.name || 'no-file')}
          />
        )}

        {activeTab === "transfer" && (
          <TransferForm
            date={date}
            setDate={setDate}
            spaceCurrency={spaceCurrency}
            prefillAmount={sharedAmount}
            onPrefillAmountChange={setSharedAmount}
            onSubmitSuccess={onTransactionSuccess}
            onCancel={handleClose}
            initialData={transferInitialData}
            key={JSON.stringify(transferInitialData?.file?.name || 'no-file')}
          />
        )}

        {activeTab === "loan" && (
          <LoanForm
            date={date}
            setDate={setDate}
            prefillAmount={sharedAmount}
            onPrefillAmountChange={setSharedAmount}
            onSubmitSuccess={onTransactionSuccess}
            onCancel={handleClose}
          />
        )}

        {showV2Features && activeTab === "investment" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <InvestmentForm
              date={date}
              setDate={setDate}
              onSubmitSuccess={onTransactionSuccess}
              onCancel={handleClose}
            />
          </div>
        )}

        {showV2Features && activeTab === "goal" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <GoalForm
              date={date}
              setDate={setDate}
              onSubmitSuccess={onTransactionSuccess}
              onCancel={handleClose}
            />
          </div>
        )}
      </div>
    </Tabs>
  );

  if (isMobile) {
    return (
      <AnimatedSheetShell
        open={isDialogOpen}
        onRequestClose={handleClose}
        titleId={titleId}
        side="right"
        swipeToClose
        historyKey="__fintrAddTransactionSheet"
        panelClassName="w-full flex flex-col h-full min-h-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
          <h2
            id={titleId}
            className="text-lg font-semibold text-primary"
          >
            Add Transaction
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClose}
            aria-label="Close"
            data-tutorial-target="transaction-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {formContent}
      </AnimatedSheetShell>
    );
  }

  return (
    <CustomModal
      isOpen={isDialogOpen}
      onClose={handleClose}
      title="Add Transaction"
      maxWidth="2xl"
      className="p-0"
      closeButtonDataTarget="transaction-close"
      pinBodyLayout
    >
      {formContent}
    </CustomModal>
  );
};

export default AddTransactionDialog;
