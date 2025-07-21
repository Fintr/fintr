import React, { useState } from "react";
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
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
}) => {
  // Internal state for the form
  const [loanForm, setLoanForm] = useState({
    amount: "",
    description: "",
    type: "borrowed", // default to borrowed
    person: "",
    interestRate: "",
    dueDate: new Date(),
    loanTerm: "",
    paymentType: "one-time", // default to one-time
    receipt: null as File | null,
  });

  // Handle file upload for this form
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLoanForm((prev) => ({ ...prev, receipt: file }));
    } else {
      setLoanForm((prev) => ({ ...prev, receipt: null }));
    }
  };

  // Determine if due date should be shown based on payment type
  const showDueDate = loanForm.paymentType === "one-time";

  return (
    <div className="space-y-4">
      {/* First row: Date and Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-date" className="text-sm">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal text-sm"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMMM d, yyyy") : <span className="text-sm">Pick a date</span>}
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
          <Label htmlFor="loan-amount" className="text-sm">Amount</Label>
          <Input
            id="loan-amount"
            type="number"
            placeholder="0.00"
            value={loanForm.amount}
            onChange={(e) =>
              setLoanForm({ ...loanForm, amount: e.target.value })
            }
            className="text-sm"
          />
        </div>
      </div>

      {/* Second row: Loan Term and Payment Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-term" className="text-sm">Loan Term</Label>
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
              className="pr-16 text-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 text-sm">
              Month{parseInt(loanForm.loanTerm) !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-payment-type" className="text-sm">Payment Type</Label>
          <Select
            value={loanForm.paymentType}
            onValueChange={(value) =>
              setLoanForm({ ...loanForm, paymentType: value })
            }
          >
            <SelectTrigger id="loan-payment-type" className="text-sm">
              <SelectValue placeholder="Select payment type" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time" className="text-sm">One Time</SelectItem>
              <SelectItem value="installment" className="text-sm">Installment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Third row: Loan Type and Person */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-type" className="text-sm">Loan Type</Label>
          <Select
            value={loanForm.type}
            onValueChange={(value) => setLoanForm({ ...loanForm, type: value })}
          >
            <SelectTrigger id="loan-type" className="text-sm">
              <SelectValue placeholder="Select type" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="borrowed" className="text-sm">Money Borrowed</SelectItem>
              <SelectItem value="lent" className="text-sm">Money Lent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-person" className="text-sm">
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
            className="text-sm"
          />
        </div>
      </div>

      {/* Fourth row: Monthly Interest Rate and Description */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-interest" className="text-sm">Monthly Interest Rate</Label>
          <div className="relative">
            <Input
              id="loan-interest"
              type="number"
              placeholder="0.00"
              value={loanForm.interestRate}
              onChange={(e) =>
                setLoanForm({ ...loanForm, interestRate: e.target.value })
              }
              className="pr-8 text-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 text-sm">
              %
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-description" className="text-sm">Note (Optional)</Label>
          <Input
            id="loan-description"
            placeholder="Purpose of loan"
            value={loanForm.description}
            onChange={(e) =>
              setLoanForm({ ...loanForm, description: e.target.value })
            }
            className="text-sm"
          />
        </div>
      </div>

      {/* Fifth row: Attachment field (full width) */}
      <div className="space-y-2">
        <Label className="text-sm">Attach Doc (Optional)</Label>
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
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
};

export default LoanForm;
