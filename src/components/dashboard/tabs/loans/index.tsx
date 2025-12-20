import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarLucide, Percent, FileText, ChevronDown, ChevronUp, Info, Wallet, CalendarIcon, Receipt, Edit, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import { useInfiniteLoans } from "@/hooks/async/useInfiniteLoans";
import { useLoanPayments } from "@/hooks/async/useLoanPayments";
import { formatCurrency } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import { Loan } from "@/services/loans/queries";
import { useAuthApi } from "@/hooks/useAuthApi";
import { deleteLoan } from "@/services/loans/mutation";
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { useNumberInput } from "@/hooks/useNumberInput";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { numberFormatting } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format, endOfMonth } from "date-fns";
import DeleteLoanPaymentModal from "@/components/dashboard/forms/DeleteLoanPaymentModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface LoansTabProps {}

interface PaymentScheduleItem {
  paymentDate: Date;
  beginningBalance: number;
  paymentAmount: number;
  principalPayment: number;
  interestPayment: number;
  endingBalance: number;
  isActual?: boolean;
}

// Use backend schedule if available, otherwise calculate locally
const getAmortizationSchedule = (loan: Loan): PaymentScheduleItem[] => {
  // If backend provides schedule, use it
  if (loan.amortizationSchedule && loan.amortizationSchedule.length > 0) {
    return loan.amortizationSchedule.map(item => ({
      paymentDate: new Date(item.paymentDate),
      beginningBalance: typeof item.beginningBalance === 'string' 
        ? parseFloat(item.beginningBalance) 
        : item.beginningBalance,
      paymentAmount: typeof item.paymentAmount === 'string'
        ? parseFloat(item.paymentAmount)
        : item.paymentAmount,
      principalPayment: typeof item.principalPayment === 'string'
        ? parseFloat(item.principalPayment)
        : item.principalPayment,
      interestPayment: typeof item.interestPayment === 'string'
        ? parseFloat(item.interestPayment)
        : item.interestPayment,
      endingBalance: typeof item.endingBalance === 'string'
        ? parseFloat(item.endingBalance)
        : item.endingBalance,
      isActual: item.isActual || false
    }));
  }
  
  // Fallback to local calculation
  return calculateAmortizationSchedule(loan);
};

const calculateAmortizationSchedule = (loan: Loan): PaymentScheduleItem[] => {
  const schedule: PaymentScheduleItem[] = [];
  const startDate = new Date(loan.date);
  
  // Ensure numeric values (handle API returning strings)
  const principalAmount = typeof loan.principalAmount === 'string' 
    ? parseFloat(loan.principalAmount) 
    : loan.principalAmount;
  const interestRate = typeof loan.interestRate === 'string'
    ? parseFloat(loan.interestRate)
    : loan.interestRate;
  const termMonths = typeof loan.loanTermMonths === 'string'
    ? parseInt(loan.loanTermMonths, 10)
    : loan.loanTermMonths;
  
  const annualRate = interestRate / 100;
  const monthlyRate = annualRate / 12; // Used for PMT formula calculation
  const dailyRate = annualRate / 365; // Used for daily simple interest calculation
  
  if (principalAmount <= 0 || termMonths <= 0 || isNaN(principalAmount) || isNaN(interestRate) || isNaN(termMonths)) {
    return schedule;
  }
  
  // Standard Amortization Formula: PMT = P × [r(1 + r)^n] / [(1 + r)^n - 1]
  // Where:
  // P = Loan principal (original loan amount)
  // r = Monthly interest rate (annual rate / 12) - used for PMT calculation only
  // n = Total number of payments (loan term in months)
  // Note: Monthly rate is used for PMT formula, but interest is calculated using daily simple interest
  let fixedMonthlyPayment = 0;
  if (monthlyRate > 0) {
    const r = monthlyRate;
    const n = termMonths;
    const P = principalAmount;
    
    // Calculate: r × (1 + r)^n
    const numerator = r * Math.pow(1 + r, n);
    // Calculate: (1 + r)^n - 1
    const denominator = Math.pow(1 + r, n) - 1;
    
    // PMT = P × [numerator / denominator]
    fixedMonthlyPayment = P * (numerator / denominator);
  } else {
    // If interest rate is 0, just divide principal by number of months
    fixedMonthlyPayment = principalAmount / termMonths;
  }
  
  // Start with the original principal amount (use full precision)
  let remainingBalance = principalAmount;
  
  // First payment date is one month after loan start date
  const firstPaymentDate = new Date(startDate);
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
  firstPaymentDate.setHours(0, 0, 0, 0);
  
  let currentPaymentDate = new Date(firstPaymentDate);
  
  // Round the fixed monthly payment to 2 decimal places first
  const roundedFixedPayment = Math.round(fixedMonthlyPayment * 100) / 100;
  
  // Generate amortization schedule for each payment period
  // Note: dailyRate is already calculated above and used for daily simple interest
  for (let paymentNum = 0; paymentNum < termMonths; paymentNum++) {
    // Step 1: Round beginning balance to 2 decimal places
    const beginningBalance = Math.round(remainingBalance * 100) / 100;
    
    // Step 2: Calculate Interest Payment for this period using daily simple interest
    // Formula: Interest = Beginning Balance × Daily Rate × Days
    // This matches the backend's daily simple interest approach
    const previousPaymentDate = paymentNum === 0 
      ? new Date(startDate)
      : (() => {
          const prev = new Date(currentPaymentDate);
          prev.setMonth(prev.getMonth() - 1);
          return prev;
        })();
    
    // Calculate actual days between payments (handles variable month lengths)
    const daysBetween = Math.round(
      (currentPaymentDate.getTime() - previousPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Use daily simple interest: Balance × Daily Rate × Days
    // dailyRate is defined at function scope (annualRate / 365)
    const interestPaymentCalc = beginningBalance * dailyRate * daysBetween;
    const interestPayment = Math.round(interestPaymentCalc * 100) / 100;
    
    // Step 3: Calculate Principal Payment and Payment Amount
    let principalPayment = 0;
    let actualPaymentAmount = 0;
    
    // For the last payment, adjust to ensure balance reaches exactly $0.00
    const isLastPayment = paymentNum === termMonths - 1;
    
    if (isLastPayment) {
      // Last payment: Principal = remaining beginning balance, Payment = Principal + Interest
      principalPayment = beginningBalance;
      actualPaymentAmount = Math.round((principalPayment + interestPayment) * 100) / 100;
    } else {
      // Regular payment: Use fixed payment amount (already rounded)
      actualPaymentAmount = roundedFixedPayment;
      // Principal = Payment - Interest (may have small rounding differences)
      principalPayment = actualPaymentAmount - interestPayment;
      
      // Round principal payment
      principalPayment = Math.round(principalPayment * 100) / 100;
      
      // Ensure principal doesn't exceed remaining balance (safety check)
      if (principalPayment > beginningBalance) {
        principalPayment = beginningBalance;
        actualPaymentAmount = Math.round((principalPayment + interestPayment) * 100) / 100;
      }
    }
    
    // Step 4: Calculate ending balance
    const endingBalance = beginningBalance - principalPayment;
    const roundedEndingBalance = Math.max(0, Math.round(endingBalance * 100) / 100);
    
    // Store all values (already rounded)
    schedule.push({
      paymentDate: new Date(currentPaymentDate),
      beginningBalance: beginningBalance,
      paymentAmount: actualPaymentAmount,
      principalPayment: principalPayment,
      interestPayment: interestPayment,
      endingBalance: roundedEndingBalance
    });
    
    // Step 5: Update remaining balance for next iteration (use rounded ending balance)
    remainingBalance = roundedEndingBalance;
    
    // Move to next month
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
    
    // If balance is paid off, stop
    if (remainingBalance <= 0.01) {
      break;
    }
  }
  
  return schedule;
};

const LoansTab = ({}: LoansTabProps) => {
  const [isAddLoanOpen, setIsAddLoanOpen] = React.useState(false);
  const [expandedLoanId, setExpandedLoanId] = React.useState<string | null>(null);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const { 
    loans, 
    isFetching,
    isError, 
    error, 
    refetch, 
    isSuccess,
    isFetchingNextPage,
    hasNextPage
  } = useInfiniteLoans({ loadMoreRef });
  
  const isLoading = isFetching && loans.length === 0;
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions write:transactions",
  });

  const handleAddLoanSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setIsAddLoanOpen(false);
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!api) {
      throw new Error("API not available");
    }
    const response = await deleteLoan(api, loanId);
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    return response;
  };

  const sortedLoans = React.useMemo(() => {
    return [...loans].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [loans]);

  let lastDisplayedDate: string | null = null;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Loans</CardTitle>
          <CardDescription>
            Manage your borrowed and lent money
          </CardDescription>
        </div>
        <Button
          onClick={() => setIsAddLoanOpen(true)}
          className="bg-primary hover:bg-primary/80"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Loan
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-900 mb-4">Error loading loans</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {isSuccess && sortedLoans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No loans yet</p>
            <p className="text-sm text-gray-400">
              Start tracking your loans by clicking "Add Loan"
            </p>
          </div>
        )}

        {isSuccess && sortedLoans.length > 0 && (
          <div className="space-y-2">
            {sortedLoans.map((loan, idx) => {
              const loanDate = new Date(loan.date);
              const currentDate = loanDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              let showDivider = false;

              if (currentDate !== lastDisplayedDate) {
                showDivider = true;
                lastDisplayedDate = currentDate;
              }

              const isBorrowed = loan.loanType === 'borrowed';
              const colorClass = isBorrowed 
                ? 'bg-red-900' 
                : 'bg-teal-600';
              const textColorClass = isBorrowed 
                ? 'text-red-900' 
                : 'text-teal-600';
              const statusColorClass = loan.status === 'paid_off' 
                ? 'bg-green-100 text-green-800' 
                : loan.status === 'defaulted' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-blue-100 text-blue-800';

              return (
                <React.Fragment key={loan.id}>
                  {showDivider && (
                    <div
                      key={`divider-${currentDate}-${idx}`}
                      className="flex items-center my-5"
                    >
                      <div className="border-t border-gray-300" style={{width: '2rem'}} />
                      <span className="text-xs font-semibold text-primary bg-background px-3">
                        {currentDate}
                      </span>
                      <div className="flex-grow border-t border-gray-300" />
                    </div>
                  )}
                  <div>
                    <div 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors min-h-[80px]"
                    >
                      <div
                        className={`w-1 rounded mr-3 flex-shrink-0 self-stretch ${colorClass}`}
                      />
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-auto min-w-0">
                            <h4 className="font-medium text-sm text-primary truncate">
                              {loan.entityName}
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColorClass}`}>
                              {loan.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`font-semibold text-sm ${textColorClass} flex-shrink-0`}>
                              {formatCurrency(loan.outstandingBalance, loan.outstandingBalanceCurrency)}
                            </div>
                            {expandedLoanId === loan.id ? (
                              <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 relative">
                          <div className="flex items-center gap-1">
                            <CalendarLucide className="h-3 w-3" />
                            <span>{loanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            <span>{loan.interestRate}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Principal:</span>
                            <span>{formatCurrency(loan.principalAmount, loan.principalAmountCurrency)}</span>
                          </div>
                          {loan.description && (
                            <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
                              <FileText className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{loan.description}</span>
                            </div>
                          )}
                        </div>

                        {loan.description && (
                          <div className="md:hidden flex items-center gap-1 mt-1 mb-1 text-xs text-gray-600">
                            <FileText className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{loan.description}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className={`${textColorClass} font-medium`}>
                              {isBorrowed ? 'Borrowed' : 'Lent'}
                            </span>
                            <span className="text-gray-500">
                              <span className="font-medium">Term:</span> {loan.loanTermMonths} Month{loan.loanTermMonths !== 1 ? 's' : ''}
                            </span>
                            <span className="text-gray-500">
                              Matures: {new Date(loan.maturityDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {loan.files && loan.files.length > 0 && (
                              <span className="text-gray-500">
                                {loan.files.length} file{loan.files.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <DeleteLoanModal
                            loan={loan}
                            onDelete={handleDeleteLoan}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {expandedLoanId === loan.id && (
                      <LoanDetailsExpanded loan={loan} isBorrowed={isBorrowed} textColorClass={textColorClass} />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={loadMoreRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex justify-center items-center py-4">
                <LoadingSpinner />
              </div>
            )}
            {!hasNextPage && sortedLoans.length > 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                No more loans to load
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AddTransactionDialog
        isOpen={isAddLoanOpen}
        onClose={() => setIsAddLoanOpen(false)}
        initialTransactionType="loan"
        onAddTransaction={handleAddLoanSuccess}
      />
    </Card>
  );
};

interface LoanDetailsExpandedProps {
  loan: Loan;
  isBorrowed: boolean;
  textColorClass: string;
}

const LoanDetailsExpanded: React.FC<LoanDetailsExpandedProps> = ({ loan, isBorrowed, textColorClass }) => {
  // Use backend schedule which incorporates actual payments and adjusts accordingly
  const schedule = React.useMemo(() => getAmortizationSchedule(loan), [loan]);
  const { createPayment, isCreating, payments, isLoading: isLoadingPayments, updatePayment, deletePayment, isUpdating, isDeleting } = useLoanPayments(loan.id);
  const accountOptions = useAtomValue(accountOptionsAtom);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<typeof payments[0] | null>(null);
  const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = React.useState(false);
  const [paymentToDelete, setPaymentToDelete] = React.useState<typeof payments[0] | null>(null);
  const [showPaymentsView, setShowPaymentsView] = React.useState(false);
  const [paymentDate, setPaymentDate] = React.useState<Date | undefined>(new Date());
  const [accountName, setAccountName] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  
  const totalPaymentInput = useNumberInput({
    initialValue: "",
  });
  
  const totalInterest = React.useMemo(() => {
    const sum = schedule.reduce((acc, payment) => acc + payment.interestPayment, 0);
    return Math.round(sum * 100) / 100;
  }, [schedule]);
  
  const totalPrincipal = React.useMemo(() => {
    const principalAmount = typeof loan.principalAmount === 'string' 
      ? parseFloat(loan.principalAmount) 
      : loan.principalAmount;
    return Math.round(principalAmount * 100) / 100;
  }, [loan]);
  
  const totalPrincipalPaid = React.useMemo(() => {
    const sum = schedule.reduce((acc, payment) => acc + payment.principalPayment, 0);
    return Math.round(sum * 100) / 100;
  }, [schedule]);
  
  const totalPayments = React.useMemo(() => {
    const sum = schedule.reduce((acc, payment) => acc + payment.paymentAmount, 0);
    return Math.round(sum * 100) / 100;
  }, [schedule]);
  
  const netCost = React.useMemo(() => {
    return Math.round((totalPayments - totalPrincipalPaid) * 100) / 100;
  }, [totalPayments, totalPrincipalPaid]);

  const handleAddPayment = async () => {
    setFormSubmitted(true);
    setValidationErrors({});

    const errors: Record<string, string> = {};
    
    const totalPaymentValue = numberFormatting.cleanForBackend(totalPaymentInput.displayValue);
    if (!totalPaymentInput.displayValue || totalPaymentValue <= 0) {
      errors.totalPayment = "Payment amount is required and must be greater than 0";
    }
    
    if (!accountName) {
      errors.accountName = "Account is required";
    }
    
    if (!paymentDate) {
      errors.date = "Payment date is required";
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await createPayment({
        accountName,
        date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : "",
        totalPayment: totalPaymentValue,
        notes: notes || undefined,
      });
      
              toast.success("Payment recorded successfully");
              setIsPaymentDialogOpen(false);
              setPaymentDate(new Date());
              setAccountName("");
              setNotes("");
              totalPaymentInput.reset();
              setFormSubmitted(false);
              setValidationErrors({});
    } catch (error: any) {
      const fieldErrors = extractFieldErrors(error);
      // Convert string[] to string for validation errors
      const stringErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        const errorValue = fieldErrors[key];
        stringErrors[key] = Array.isArray(errorValue) ? errorValue[0] || "" : errorValue || "";
      });
      setValidationErrors(stringErrors);
      
      if (Object.keys(stringErrors).length === 0) {
        toast.error("Failed to record payment. Please try again.");
      }
    }
  };

  return (
    <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b">
        <div>
          <div className="text-xs text-gray-500 mb-1">Total Principal</div>
          <div className="text-sm font-semibold text-primary">
            {formatCurrency(totalPrincipal, loan.principalAmountCurrency)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            Total Interest
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-400 hover:text-gray-600">
                  <Info className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-primary mb-2">Interest Calculation</h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Formula (Daily Simple Interest):</div>
                      <div className="text-gray-600 bg-gray-50 p-2 rounded font-mono text-xs">
                        Daily Rate = Annual Rate ÷ 365
                        <br />
                        Interest = Beginning Balance × Daily Rate × Days
                        <br />
                        Principal = Payment - Interest
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Your Loan:</div>
                      <div className="text-gray-600 space-y-1">
                        <div>Annual Rate: {loan.interestRate}%</div>
                        <div>Daily Rate: {((loan.interestRate / 100) / 365 * 100).toFixed(6)}%</div>
                        <div>Number of Payments: {schedule.length}</div>
                        <div>Principal: {formatCurrency(loan.principalAmount, loan.principalAmountCurrency)}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="font-medium text-gray-700 mb-1">Calculation Method:</div>
                      <div className="text-gray-600">
                        Daily simple interest: Interest accrues daily based on the actual number of days between payments. Early payments reduce interest, late payments accrue more interest. This is the industry standard for loans with variable payment dates.
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="font-medium text-gray-700 mb-1">Total Interest Breakdown:</div>
                      <div className="text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                        {schedule.map((payment, idx) => {
                          // Calculate days since last payment (or loan date for first payment)
                          const loanStartDate = new Date(loan.date);
                          const previousPaymentDate = idx > 0 
                            ? schedule[idx - 1].paymentDate 
                            : loanStartDate;
                          const daysDiff = Math.round(
                            (payment.paymentDate.getTime() - previousPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const dailyRate = (loan.interestRate / 100) / 365;
                          const calculatedInterest = payment.beginningBalance * dailyRate * daysDiff;
                          return (
                            <div key={idx} className="text-xs">
                              <div className="font-medium">Payment {idx + 1} ({payment.paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}):</div>
                              <div className="ml-2 text-gray-500">
                                {formatCurrency(payment.interestPayment, loan.outstandingBalanceCurrency)} = {formatCurrency(payment.beginningBalance, loan.outstandingBalanceCurrency)} × {((dailyRate * 100).toFixed(6))}% × {daysDiff} days
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className={`text-sm font-semibold ${textColorClass}`}>
            {formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">
            {isBorrowed ? 'Total Cost' : 'Total Gain'}
          </div>
          <div className={`text-sm font-semibold ${textColorClass}`}>
            {isBorrowed 
              ? `-${formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}`
              : `+${formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}`
            }
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-primary">
            {showPaymentsView ? "Payments Made" : "Payment Schedule"}
          </h5>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs"
              onClick={() => setShowPaymentsView(!showPaymentsView)}
            >
              {showPaymentsView ? (
                <>
                  <CalendarLucide className="h-3 w-3 mr-1" />
                  <span className="hidden md:inline">Show Payment Schedule</span>
                  <span className="md:hidden">Show Schedule</span>
                </>
              ) : (
                <>
                  <Receipt className="h-3 w-3 mr-1" />
                  View Payments ({payments.length})
                </>
              )}
            </Button>
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs">
                  <Wallet className="h-3 w-3 mr-1" />
                  Add Payment
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Record Loan Payment</DialogTitle>
                <DialogDescription>
                  Record a payment for this loan. Principal and interest will be calculated automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-date" className="text-sm">Payment Date</Label>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start text-left font-normal text-sm ${formSubmitted && validationErrors.date ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar 
                        mode="single" 
                        selected={paymentDate} 
                        onSelect={(date) => {
                          setPaymentDate(date);
                          if (formSubmitted && validationErrors.date) {
                            setValidationErrors({ ...validationErrors, date: "" });
                          }
                        }} 
                        initialFocus 
                        defaultMonth={paymentDate || new Date()}
                        toDate={new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  {formSubmitted && validationErrors.date && (
                    <FormError message={validationErrors.date} />
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-account" className="text-sm">Account</Label>
                  <Select
                    value={accountName}
                    onValueChange={(value) => {
                      setAccountName(value);
                      if (formSubmitted && validationErrors.accountName) {
                        setValidationErrors({ ...validationErrors, accountName: "" });
                      }
                    }}
                  >
                    <SelectTrigger 
                      id="payment-account"
                      className={`text-sm ${formSubmitted && validationErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                    >
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((account) => (
                        <SelectItem key={account.value} value={account.value} className="text-sm">
                          {account.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formSubmitted && validationErrors.accountName && (
                    <FormError message={validationErrors.accountName} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-amount" className="text-sm">Total Payment Amount</Label>
                  <Input
                    id="payment-amount"
                    type="text"
                    value={totalPaymentInput.displayValue}
                    onChange={(e) => {
                      totalPaymentInput.handleInputChange(e.target.value);
                      if (formSubmitted && validationErrors.totalPayment) {
                        setValidationErrors({ ...validationErrors, totalPayment: "" });
                      }
                    }}
                    placeholder="0.00"
                    className={`text-sm ${formSubmitted && validationErrors.totalPayment ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  />
                  {formSubmitted && validationErrors.totalPayment && (
                    <FormError message={validationErrors.totalPayment} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-notes" className="text-sm">Notes (Optional)</Label>
                  <Textarea
                    id="payment-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    className="text-sm min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPaymentDialogOpen(false);
                      setPaymentDate(new Date());
                      setAccountName("");
                      setNotes("");
                      totalPaymentInput.reset();
                      setFormSubmitted(false);
                      setValidationErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPayment}
                    disabled={isCreating}
                  >
                    {isCreating ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        
        <Dialog open={isEditPaymentDialogOpen} onOpenChange={setIsEditPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Loan Payment</DialogTitle>
              <DialogDescription>
                Update payment details. Principal and interest will be recalculated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-payment-date" className="text-sm">Payment Date</Label>
                <Popover modal>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start text-left font-normal text-sm ${formSubmitted && validationErrors.date ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={paymentDate} 
                      onSelect={(date) => {
                        setPaymentDate(date);
                        if (formSubmitted && validationErrors.date) {
                          setValidationErrors({ ...validationErrors, date: "" });
                        }
                      }} 
                      initialFocus 
                      defaultMonth={paymentDate || new Date()}
                      toDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
                {formSubmitted && validationErrors.date && (
                  <FormError message={validationErrors.date} />
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-payment-account" className="text-sm">Account</Label>
                <Select
                  value={accountName}
                  onValueChange={(value) => {
                    setAccountName(value);
                    if (formSubmitted && validationErrors.accountName) {
                      setValidationErrors({ ...validationErrors, accountName: "" });
                    }
                  }}
                >
                  <SelectTrigger 
                    id="edit-payment-account"
                    className={`text-sm ${formSubmitted && validationErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  >
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="text-sm">
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && validationErrors.accountName && (
                  <FormError message={validationErrors.accountName} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-amount" className="text-sm">Total Payment Amount</Label>
                <Input
                  id="edit-payment-amount"
                  type="text"
                  value={totalPaymentInput.displayValue}
                  onChange={(e) => {
                    totalPaymentInput.handleInputChange(e.target.value);
                    if (formSubmitted && validationErrors.totalPayment) {
                      setValidationErrors({ ...validationErrors, totalPayment: "" });
                    }
                  }}
                  placeholder="0.00"
                  className={`text-sm ${formSubmitted && validationErrors.totalPayment ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                {formSubmitted && validationErrors.totalPayment && (
                  <FormError message={validationErrors.totalPayment} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-notes" className="text-sm">Notes (Optional)</Label>
                <Textarea
                  id="edit-payment-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  className="text-sm min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditPaymentDialogOpen(false);
                    setEditingPayment(null);
                    setPaymentDate(new Date());
                    setAccountName("");
                    setNotes("");
                    totalPaymentInput.reset();
                    setFormSubmitted(false);
                    setValidationErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingPayment) return;
                    
                    setFormSubmitted(true);
                    setValidationErrors({});

                    const errors: Record<string, string> = {};
                    
                    const totalPaymentValue = numberFormatting.cleanForBackend(totalPaymentInput.displayValue);
                    if (!totalPaymentInput.displayValue || totalPaymentValue <= 0) {
                      errors.totalPayment = "Payment amount is required and must be greater than 0";
                    }
                    
                    if (!accountName) {
                      errors.accountName = "Account is required";
                    }
                    
                    if (!paymentDate) {
                      errors.date = "Payment date is required";
                    }
                    
                    if (Object.keys(errors).length > 0) {
                      setValidationErrors(errors);
                      return;
                    }

                    try {
                      await updatePayment({
                        paymentId: editingPayment.id,
                        paymentData: {
                          accountName,
                          date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : "",
                          totalPayment: totalPaymentValue,
                          notes: notes || undefined,
                        }
                      });
                      
                      toast.success("Payment updated successfully");
                      setIsEditPaymentDialogOpen(false);
                      setEditingPayment(null);
                      setPaymentDate(new Date());
                      setAccountName("");
                      setNotes("");
                      totalPaymentInput.reset();
                      setFormSubmitted(false);
                      setValidationErrors({});
                    } catch (error: any) {
                      const fieldErrors = extractFieldErrors(error);
                      const stringErrors: Record<string, string> = {};
                      Object.keys(fieldErrors).forEach(key => {
                        const errorValue = fieldErrors[key];
                        stringErrors[key] = Array.isArray(errorValue) ? errorValue[0] || "" : errorValue || "";
                      });
                      setValidationErrors(stringErrors);
                      
                      if (Object.keys(stringErrors).length === 0) {
                        toast.error("Failed to update payment. Please try again.");
                      }
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update Payment"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <DeleteLoanPaymentModal
          isOpen={isDeletePaymentModalOpen}
          onClose={() => {
            setIsDeletePaymentModalOpen(false);
            setTimeout(() => {
              setPaymentToDelete(null);
            }, 300);
          }}
          onConfirm={async () => {
            if (!paymentToDelete) return;
            
            try {
              await deletePayment(paymentToDelete.id);
              toast.success("Payment deleted successfully");
              setIsDeletePaymentModalOpen(false);
              setTimeout(() => {
                setPaymentToDelete(null);
              }, 300);
            } catch (error: any) {
              toast.error("Failed to delete payment. Please try again.");
            }
          }}
          isDeleting={isDeleting}
        />
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              {showPaymentsView ? (
                <>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow className="hover:bg-gray-50">
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap px-3 py-2">Date</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[100px] whitespace-nowrap px-3 py-2">Account</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[110px] whitespace-nowrap text-right px-3 py-2">Principal</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[110px] whitespace-nowrap text-right px-3 py-2">Interest</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[110px] whitespace-nowrap text-right px-3 py-2">Total</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[150px] whitespace-nowrap px-3 py-2">Notes</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[100px] whitespace-nowrap text-right px-3 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingPayments ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 px-3">
                          <LoadingSpinner />
                        </TableCell>
                      </TableRow>
                    ) : payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 px-3">
                          <p className="text-gray-500 text-sm">No payments recorded yet</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-gray-50">
                            <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                              {format(new Date(payment.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                              {payment.accountName}
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 whitespace-nowrap text-right px-3 py-2">
                              {formatCurrency(payment.principalPayment, payment.currency)}
                            </TableCell>
                            <TableCell className={`text-xs whitespace-nowrap text-right px-3 py-2 ${textColorClass}`}>
                              {formatCurrency(payment.interestPayment, payment.currency)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-gray-700 whitespace-nowrap text-right px-3 py-2">
                              {formatCurrency(payment.totalPayment, payment.currency)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 truncate px-3 py-2" title={payment.notes || ""}>
                              {payment.notes || "-"}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap text-right px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setEditingPayment(payment);
                                    setPaymentDate(new Date(payment.date));
                                    setAccountName(payment.accountName);
                                    setNotes(payment.notes || "");
                                    totalPaymentInput.handleInputChange(payment.totalPayment.toString());
                                    setIsEditPaymentDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-900 hover:text-red-700"
                                  onClick={() => {
                                    setPaymentToDelete(payment);
                                    setIsDeletePaymentModalOpen(true);
                                  }}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </>
              ) : (
                <>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow className="hover:bg-gray-50">
                      <TableHead className="text-xs font-medium text-gray-600 w-[140px] whitespace-nowrap px-3 py-2">Date</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap text-right px-3 py-2">Beginning</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap text-right px-3 py-2">Payment</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap text-right px-3 py-2">Principal</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap text-right px-3 py-2">Interest</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600 w-[120px] whitespace-nowrap text-right px-3 py-2">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((payment, index) => (
                      <TableRow 
                        key={index} 
                        className={`hover:bg-gray-50 ${
                          payment.isActual ? 'bg-blue-50' : ''
                        }`}
                      >
                        <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                          <span>{payment.paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {payment.isActual && (
                            <span className="text-xs text-blue-600 font-medium ml-1">(Paid)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 whitespace-nowrap text-right px-3 py-2">
                          {formatCurrency(payment.beginningBalance, loan.outstandingBalanceCurrency)}
                        </TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap text-right px-3 py-2">
                          {formatCurrency(payment.paymentAmount, loan.outstandingBalanceCurrency)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 whitespace-nowrap text-right px-3 py-2">
                          {formatCurrency(payment.principalPayment, loan.outstandingBalanceCurrency)}
                        </TableCell>
                        <TableCell className={`text-xs whitespace-nowrap text-right px-3 py-2 ${textColorClass}`}>
                          {formatCurrency(payment.interestPayment, loan.outstandingBalanceCurrency)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 whitespace-nowrap text-right px-3 py-2">
                          {formatCurrency(payment.endingBalance, loan.outstandingBalanceCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </>
              )}
            </Table>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <div className="text-xs text-gray-600">
          <div className="flex justify-between items-center mb-1">
            <span>Principal Amount:</span>
            <span className="font-medium">{formatCurrency(loan.principalAmount, loan.principalAmountCurrency)}</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span>Total Interest {isBorrowed ? 'Paid' : 'Earned'}:</span>
            <span className={`font-medium ${textColorClass}`}>
              {formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Net {isBorrowed ? 'Cost' : 'Gain'}:</span>
            <span className={`font-semibold text-base ${textColorClass}`}>
              {isBorrowed 
                ? `-${formatCurrency(netCost, loan.outstandingBalanceCurrency)}`
                : `+${formatCurrency(netCost, loan.outstandingBalanceCurrency)}`
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoansTab;
