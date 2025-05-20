import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import {
  ExpenseForm,
  IncomeForm,
  LoanForm,
  InvestmentForm,
  TransferForm,
  GoalForm,
} from "@/components/dashboard/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  transferAmountAtom,
  transferDescriptionAtom,
} from "@/atoms/transferAtoms";

interface AddTransactionDialogProps {
  onAddTransaction?: (transaction: any) => void;
}

const AddTransactionDialog = ({
  onAddTransaction = () => {},
}: AddTransactionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get setters for transfer form atoms
  const setTransferAmount = useSetAtom(transferAmountAtom);
  const setTransferDescription = useSetAtom(transferDescriptionAtom);

  // Reset date to current date when dialog opens
  useEffect(() => {
    if (open) {
      setDate(new Date());
    } else {
      // Reset transfer form atoms when dialog closes
      setTransferAmount("");
      setTransferDescription("");
    }
  }, [open]);

  // Get access to React Query client for cache invalidation
  const queryClient = useQueryClient();

  // Create form refs for each form type
  const expenseFormRef = useRef<HTMLFormElement | null>(null);

  // Form state for investment
  const [investmentForm, setInvestmentForm] = useState({
    amount: "",
    name: "",
    description: "",
    category: "",
    receipt: null as File | null,
  });

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

  // For custom investment categories
  const [customInvestmentCategories, setCustomInvestmentCategories] = useState<
    string[]
  >([]);

  // Form states for each transaction type
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    category: "",
    paymentMethod: "",
    scheduleType: "one_time" as "one_time" | "repeat" | "installment",
    installment_period: 0,
    account: "",
    file: null as File | null,
  });

  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    description: "",
    category: "",
    source: "",
    account: "",
    scheduleType: "one_time",
    receipt: null as File | null,
  });

  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<
    string[]
  >([]);

  // For custom account functionality
  const [showCustomAccountInput, setShowCustomAccountInput] = useState(false);
  const [customAccount, setCustomAccount] = useState("");
  const [customAccounts, setCustomAccounts] = useState<string[]>([]);

  const [loanForm, setLoanForm] = useState({
    amount: "",
    description: "",
    type: "borrowed", // borrowed or lent
    person: "",
    interestRate: "",
    dueDate: new Date(),
    loanTerm: "", // in months
    paymentType: "one-time", // one-time or installment
    receipt: null as File | null,
  });

  const [transferForm, setTransferForm] = useState({
    amount: "",
    fromAccount: "",
    toAccount: "",
    description: "",
    receipt: null as File | null,
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      switch (activeTab) {
        case "income":
          // Existing code for income
          prepareAndSubmitTransaction("income");
          break;
        case "goal":
          // Existing code for goal
          prepareAndSubmitTransaction("goal");
          break;
        case "investment":
          // Existing code for investment
          prepareAndSubmitTransaction("investment");
          break;
        case "loan":
          // Existing code for loan
          prepareAndSubmitTransaction("loan");
          break;
        case "transfer":
          // Existing code for transfer
          prepareAndSubmitTransaction("transfer");
          break;
        default:
          setIsSubmitting(false);
          return;
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to submit transaction. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Function to handle transaction success from the ExpenseForm
  const onTransactionSuccess = (response: any) => {
    // Invalidate the transactions query to refresh the transactions list
    queryClient.invalidateQueries({
      queryKey: ["transactions", localStorage.getItem("spaceCode")],
    });

    // Also invalidate dashboard data as transactions affect balances
    queryClient.invalidateQueries({
      queryKey: ["dashboard", localStorage.getItem("spaceCode")],
    });

    // Call the parent callback
    onAddTransaction(response);

    // Close the dialog and reset forms
    setOpen(false);
    resetForms();
    setDate(new Date()); // Explicitly reset date to current date
    setIsSubmitting(false);
  };

  // Function to handle transaction errors
  const onTransactionError = () => {
    setIsSubmitting(false);
  };

  // Helper function to prepare and submit non-expense transactions
  const prepareAndSubmitTransaction = (type: string) => {
    let transactionData;

    switch (type) {
      case "income":
        transactionData = {
          type: "income",
          ...incomeForm,
          date: date,
          amount: Math.abs(parseFloat(incomeForm.amount)),
          category: incomeForm.category,
          account: incomeForm.account,
        };
        break;
      case "goal":
        transactionData = {
          type: "goal",
          ...goalForm,
          date: date,
          amount: Math.abs(parseFloat(goalForm.amount)),
        };
        break;
      case "investment":
        transactionData = {
          type: "investment",
          ...investmentForm,
          date: date,
          amount: -Math.abs(parseFloat(investmentForm.amount)),
        };
        break;
      case "loan":
        transactionData = {
          ...loanForm,
          type: "loan",
          date: date,
          amount:
            loanForm.type === "borrowed"
              ? Math.abs(parseFloat(loanForm.amount))
              : -Math.abs(parseFloat(loanForm.amount)),
        };
        break;
      case "transfer":
        transactionData = {
          type: "transfer",
          ...transferForm,
          date: date,
          amount: Math.abs(parseFloat(transferForm.amount)),
        };
        break;
      default:
        return;
    }

    // Invalidate the transactions query after creating a new transaction
    queryClient.invalidateQueries({
      queryKey: ["transactions", localStorage.getItem("spaceCode")],
    });

    // Also invalidate dashboard data as transactions affect balances
    queryClient.invalidateQueries({
      queryKey: ["dashboard", localStorage.getItem("spaceCode")],
    });

    onAddTransaction(transactionData);
    setOpen(false);
    resetForms();
    setIsSubmitting(false);
  };

  const resetForms = () => {
    setExpenseForm({
      amount: "",
      description: "",
      category: "",
      paymentMethod: "",
      scheduleType: "one_time" as "one_time" | "repeat" | "installment",
      installment_period: 0,
      account: "",
      file: null,
    });
    setIncomeForm({
      amount: "",
      description: "",
      category: "",
      source: "",
      account: "",
      scheduleType: "one_time",
      receipt: null,
    });
    setInvestmentForm({
      amount: "",
      name: "",
      description: "",
      category: "",
      receipt: null,
    });
    setGoalForm({
      amount: "",
      name: "",
      description: "",
      category: "",
      targetDate: new Date(),
      receipt: null,
      monthlyContribution: "",
      priority: "",
    });
    setShowCustomCategoryInput(false);
    setCustomCategory("");
    setLoanForm({
      amount: "",
      description: "",
      type: "borrowed",
      person: "",
      interestRate: "",
      dueDate: new Date(),
      loanTerm: "",
      paymentType: "one-time",
      receipt: null,
    });
    setTransferForm({
      amount: "",
      fromAccount: "",
      toAccount: "",
      description: "",
      receipt: null,
    });

    // Reset transfer atoms
    setTransferAmount("");
    setTransferDescription("");

    setDate(new Date());
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      switch (formType) {
        case "expense":
          setExpenseForm({ ...expenseForm, file: file });
          break;
        case "income":
          setIncomeForm({ ...incomeForm, receipt: file });
          break;
        case "goal":
          setGoalForm({ ...goalForm, receipt: file });
          break;
        case "investment":
          setInvestmentForm({ ...investmentForm, receipt: file });
          break;
        case "loan":
          setLoanForm({ ...loanForm, receipt: file });
          break;
        case "transfer":
          setTransferForm({ ...transferForm, receipt: file });
          break;
      }
    }
  };

  const handleAddCustomAccount = (accountName: string) => {
    if (accountName.trim() !== "") {
      setCustomAccounts([...customAccounts, accountName]);
      setCustomAccount("");
      setShowCustomAccountInput(false);
      return accountName;
    }
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0A3D62] hover:bg-[#0A3D62]/80">
          <Plus className="h-4 w-4 mr-2" /> Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] pb-8">
        <DialogHeader className="pt-2 pb-4 pr-10">
          <DialogTitle>Add New Transaction</DialogTitle>
          <DialogDescription>
            Enter the details of your transaction below.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="expense"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full mt-2"
        >
          <TabsList className="grid grid-cols-6 w-full bg-muted">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="loan">Loan</TabsTrigger>
            <TabsTrigger value="goal">Goal</TabsTrigger>
            <TabsTrigger value="investment">Investment</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>

          {/* Date picker is now moved to individual forms */}

          {/* Expense Form - updated with integrated buttons */}
          <TabsContent value="expense" className="space-y-4">
            <ExpenseForm
              date={date}
              setDate={setDate}
              onAddCustomCategory={(category) => {
                setCustomExpenseCategories([
                  ...customExpenseCategories,
                  category,
                ]);
                return category;
              }}
              onAddCustomAccount={handleAddCustomAccount}
              onSubmitSuccess={onTransactionSuccess}
              onCancel={() => setOpen(false)}
              formRef={expenseFormRef}
            />
          </TabsContent>

          {/* Income Form */}
          <TabsContent value="income" className="space-y-4">
            <IncomeForm
              date={date}
              setDate={setDate}
              onAddCustomCategory={(category) => {
                setCustomCategories([...customCategories, category]);
                return category;
              }}
              onAddCustomAccount={handleAddCustomAccount}
              onSubmitSuccess={onTransactionSuccess}
              onCancel={() => setOpen(false)}
            />
          </TabsContent>

          {/* Goal Form */}
          <TabsContent value="goal" className="space-y-4">
            <GoalForm
              goalForm={goalForm}
              setGoalForm={setGoalForm}
              handleFileUpload={handleFileUpload}
              date={date}
              setDate={setDate}
            />
          </TabsContent>

          {/* Investment Form */}
          <TabsContent value="investment" className="space-y-4">
            <InvestmentForm
              investmentForm={investmentForm}
              setInvestmentForm={setInvestmentForm}
              customInvestmentCategories={customInvestmentCategories}
              setCustomInvestmentCategories={setCustomInvestmentCategories}
              handleFileUpload={handleFileUpload}
              showCustomCategoryInput={
                showCustomCategoryInput && activeTab === "investment"
              }
              setShowCustomCategoryInput={setShowCustomCategoryInput}
              customCategory={customCategory}
              setCustomCategory={setCustomCategory}
              date={date}
              setDate={setDate}
            />
          </TabsContent>

          {/* Loan Form */}
          <TabsContent value="loan" className="space-y-4">
            <LoanForm
              loanForm={loanForm}
              setLoanForm={setLoanForm}
              handleFileUpload={handleFileUpload}
              date={date}
              setDate={setDate}
            />
          </TabsContent>

          {/* Transfer Form */}
          <TabsContent value="transfer" className="space-y-4">
            <TransferForm
              date={date}
              setDate={setDate}
              onSubmitSuccess={onTransactionSuccess}
              onCancel={() => setOpen(false)}
            />
          </TabsContent>
        </Tabs>

        {/* Show the general buttons only for non-expense and non-income tabs */}
        {activeTab !== "expense" &&
          activeTab !== "income" &&
          activeTab !== "transfer" && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  "Add Transaction"
                )}
              </Button>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
};

export default AddTransactionDialog;
