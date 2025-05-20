import React from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { Upload, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Calendar } from "../../ui/calendar";
import { format } from "date-fns";

interface LoanFormProps {
  loanForm: {
    amount: string;
    description: string;
    type: string;
    person: string;
    interestRate: string;
    dueDate: Date;
    loanTerm: string;
    paymentType: string;
    receipt: File | null;
  };
  setLoanForm: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      description: string;
      type: string;
      person: string;
      interestRate: string;
      dueDate: Date;
      loanTerm: string;
      paymentType: string;
      receipt: File | null;
    }>
  >;
  handleFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    formType: string,
  ) => void;
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
}

const LoanForm: React.FC<LoanFormProps> = ({
  loanForm,
  setLoanForm,
  handleFileUpload,
  date,
  setDate,
}) => {
  // Determine if due date should be shown based on payment type
  const showDueDate = loanForm.paymentType === "one-time";

  return (
    <div className="space-y-4">
      {/* First row: Date and Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMMM d, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-amount">Amount</Label>
          <Input
            id="loan-amount"
            type="number"
            placeholder="0.00"
            value={loanForm.amount}
            onChange={(e) =>
              setLoanForm({ ...loanForm, amount: e.target.value })
            }
          />
        </div>
      </div>

      {/* Second row: Loan Term and Payment Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-term">Loan Term</Label>
          <div className="relative">
            <Input
              id="loan-term"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="0"
              value={loanForm.loanTerm}
              onChange={(e) =>
                setLoanForm({ ...loanForm, loanTerm: e.target.value })
              }
              className="pr-16"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
              Month{parseInt(loanForm.loanTerm) !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-payment-type">Payment Type</Label>
          <Select
            value={loanForm.paymentType}
            onValueChange={(value) =>
              setLoanForm({ ...loanForm, paymentType: value })
            }
          >
            <SelectTrigger id="loan-payment-type">
              <SelectValue placeholder="Select payment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time">One Time</SelectItem>
              <SelectItem value="installment">Installment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Third row: Loan Type and Person */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-type">Loan Type</Label>
          <Select
            value={loanForm.type}
            onValueChange={(value) => setLoanForm({ ...loanForm, type: value })}
          >
            <SelectTrigger id="loan-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="borrowed">Money Borrowed</SelectItem>
              <SelectItem value="lent">Money Lent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-person">
            {loanForm.type === "borrowed" ? "Lender" : "Borrower"}
          </Label>
          <Input
            id="loan-person"
            placeholder={
              loanForm.type === "borrowed"
                ? "Who lent you money?"
                : "Who borrowed money from you?"
            }
            value={loanForm.person}
            onChange={(e) =>
              setLoanForm({ ...loanForm, person: e.target.value })
            }
          />
        </div>
      </div>

      {/* Fourth row: Monthly Interest Rate and Description */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-interest">Monthly Interest Rate</Label>
          <div className="relative">
            <Input
              id="loan-interest"
              type="number"
              placeholder="0.00"
              value={loanForm.interestRate}
              onChange={(e) =>
                setLoanForm({ ...loanForm, interestRate: e.target.value })
              }
              className="pr-8"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
              %
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-description">Note (Optional)</Label>
          <Input
            id="loan-description"
            placeholder="Purpose of loan"
            value={loanForm.description}
            onChange={(e) =>
              setLoanForm({ ...loanForm, description: e.target.value })
            }
          />
        </div>
      </div>

      {/* Fifth row: Attachment field (full width) */}
      <div className="space-y-2">
        <Label>Attach Doc (Optional)</Label>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() =>
            document.getElementById("loan-receipt-upload")?.click()
          }
        >
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Drag & drop your document here or{" "}
              <span className="text-primary font-medium">browse files</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: JPG, PNG, PDF (Max 5MB)
            </p>
            {loanForm.receipt && (
              <p className="text-sm text-green-600 mt-2">
                File selected: {loanForm.receipt.name}
              </p>
            )}
          </div>
          <input
            id="loan-receipt-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => handleFileUpload(e, "loan")}
          />
        </div>
      </div>
    </div>
  );
};

export default LoanForm;
