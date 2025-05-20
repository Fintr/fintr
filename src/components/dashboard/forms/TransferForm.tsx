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
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import {
  transferAmountAtom,
  transferTransactionCostAtom,
  transferDescriptionAtom,
  transferFromAccountNameAtom,
  transferToAccountNameAtom,
  transferScheduleTypeAtom,
  transferRepeatIntervalAtom,
  transferValidationErrorsAtom,
  createTransferAtom
} from "@/atoms/transferAtoms";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { FormError } from "@/components/ui/form-error";
import * as z from "zod";
import { ScheduleTypeEnum, REPEAT_INTERVALS } from "@/constants/transactionConstants";
import AccountCreationForm from "./AccountCreationForm";

// Transfer form schema using Zod
const transferFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Amount must be a positive number" }),
  transactionCost: z.string().refine(val => {
    if (!val || val.trim() === '') return true; // Empty is allowed, will default to 0
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: "Transaction cost must be a non-negative number" }),
  fromAccountName: z.string().min(1, "From account is required"),
  toAccountName: z.string().min(1, "To account is required"),
  description: z.string().optional(),
  scheduleType: z.nativeEnum(ScheduleTypeEnum),
  repeatInterval: z.string().optional()
}).refine(data => data.fromAccountName !== data.toAccountName, {
  message: "From and To accounts must be different",
  path: ["toAccountName"]
}).refine(
  data => data.scheduleType !== ScheduleTypeEnum.REPEAT || (data.scheduleType === ScheduleTypeEnum.REPEAT && data.repeatInterval),
  {
    message: "Repeat interval is required for recurring transfers",
    path: ["repeatInterval"]
  }
);

// Type for form values
type TransferFormValues = z.infer<typeof transferFormSchema>;

// Updated props interface
interface TransferFormProps {
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
}

const TransferForm: React.FC<TransferFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
}) => {
  const { api } = useAuthApi();
  const accountOptions = useAtomValue(accountOptionsAtom);
  
  // Form state using Jotai atoms
  const [amount, setAmount] = useAtom(transferAmountAtom);
  const [transactionCost, setTransactionCost] = useAtom(transferTransactionCostAtom);
  const [description, setDescription] = useAtom(transferDescriptionAtom);
  const [fromAccountName, setFromAccountName] = useAtom(transferFromAccountNameAtom);
  const [toAccountName, setToAccountName] = useAtom(transferToAccountNameAtom);
  const [scheduleType, setScheduleType] = useAtom(transferScheduleTypeAtom);
  const [repeatInterval, setRepeatInterval] = useAtom(transferRepeatIntervalAtom);
  const [validationErrors, setValidationErrors] = useAtom(transferValidationErrorsAtom);
  const createTransfer = useSetAtom(createTransferAtom);
  
  // Local state
  const [fileState, setFileState] = useState<File | null>(null);
  const [showFromAccountCreation, setShowFromAccountCreation] = useState(false);
  const [showToAccountCreation, setShowToAccountCreation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Validate form using Zod
  const validateForm = () => {
    try {
      // Prepare form data with appropriate handling for transactionCost default
      const formData = {
        amount,
        transactionCost,
        fromAccountName,
        toAccountName,
        description,
        scheduleType,
        // Include repeatInterval only if scheduleType is REPEAT
        ...(scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval })
      };
      
      transferFormSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          errors[path] = err.message;
        });
        setFormErrors(errors);
      }
      return false;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!date) {
      toast.error("Please select a date for the transfer");
      return;
    }
    
    setIsSubmitting(true);
    setValidationErrors({});
    
    try {
      const transferData = {
        amount: parseFloat(amount),
        transactionCost: transactionCost && transactionCost.trim() !== '' ? parseFloat(transactionCost) : 0,
        fromAccountName,
        toAccountName,
        description: description || '',
        date: format(date, 'yyyy-MM-dd'),
        scheduleType,
        ...(scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval }),
        file: fileState ?? undefined
      };
      
      const response = await createTransfer({
        api,
        transferData,
      });
      
      toast.success(`Transfer of ${transferData.amount} from ${transferData.fromAccountName} to ${transferData.toAccountName} has been recorded.`);
      
      // Reset form
      setAmount('');
      setTransactionCost('');
      setDescription('');
      setFromAccountName('');
      setToAccountName('');
      setScheduleType(ScheduleTypeEnum.ONE_TIME);
      setRepeatInterval('');
      setFileState(null);
      
      // Notify parent components of success
      onSubmitSuccess(response);
    } catch (error) {
      console.error("Error submitting transfer:", error);
      
      // If no validation errors were caught by the atom, show a general error
      if (Object.keys(validationErrors).length === 0) {
        toast.error("Failed to create transfer. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFileState(selectedFile);
    }
  };
  
  const handleFromAccountCreated = (accountName: string) => {
    if (accountName) {
      setFromAccountName(accountName);
    }
    setShowFromAccountCreation(false);
  };
  
  const handleToAccountCreated = (accountName: string) => {
    if (accountName) {
      setToAccountName(accountName);
    }
    setShowToAccountCreation(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* First row: Date (50% width) */}
      <div className="flex">
        <div className="space-y-2 w-1/2">
          <Label htmlFor="transfer-date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={"outline"}
                className={`w-full justify-start text-left font-normal`}
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
      </div>

      {/* Second row: Amount and Transaction Cost */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-amount">Amount</Label>
          <Input
            id="transfer-amount"
            type="text" 
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
            className={
              (formErrors.amount || validationErrors.amount)
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }
          />
          {formErrors.amount && (
            <FormError>{formErrors.amount}</FormError>
          )}
          {!formErrors.amount && validationErrors.amount && (
            <FormError>
              {Array.isArray(validationErrors.amount)
                ? validationErrors.amount[0]
                : String(validationErrors.amount)}
            </FormError>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-transaction-cost">Transaction Cost</Label>
          <Input
            id="transfer-transaction-cost"
            type="text" 
            value={transactionCost}
            placeholder="0.00"
            onChange={(e) => setTransactionCost(e.target.value)}
            className={
              (formErrors.transactionCost || validationErrors.transactionCost)
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }
          />
          {formErrors.transactionCost && (
            <FormError>{formErrors.transactionCost}</FormError>
          )}
          {!formErrors.transactionCost && validationErrors.transactionCost && (
            <FormError>
              {Array.isArray(validationErrors.transactionCost)
                ? validationErrors.transactionCost[0]
                : String(validationErrors.transactionCost)}
            </FormError>
          )}
        </div>
      </div>

      {/* Third row: From Account and To Account */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-from">From Account</Label>
          <Select
            value={fromAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowFromAccountCreation(true);
                setFromAccountName("");
              } else {
                setShowFromAccountCreation(false);
                setFromAccountName(value);
              }
            }}
          >
            <SelectTrigger 
              id="transfer-from"
              className={
                (formErrors.fromAccountName || validationErrors.fromAccountName)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            >
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="add_account">+ Add Account</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.fromAccountName && (
            <FormError>{formErrors.fromAccountName}</FormError>
          )}
          {!formErrors.fromAccountName && validationErrors.fromAccountName && (
            <FormError>
              {Array.isArray(validationErrors.fromAccountName)
                ? validationErrors.fromAccountName[0]
                : String(validationErrors.fromAccountName)}
            </FormError>
          )}

          {showFromAccountCreation && (
            <AccountCreationForm onSuccess={handleFromAccountCreated} />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-to">To Account</Label>
          <Select
            value={toAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowToAccountCreation(true);
                setToAccountName("");
              } else {
                setShowToAccountCreation(false);
                setToAccountName(value);
              }
            }}
          >
            <SelectTrigger 
              id="transfer-to"
              className={
                (formErrors.toAccountName || validationErrors.toAccountName)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            >
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="add_account">+ Add Account</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.toAccountName && (
            <FormError>{formErrors.toAccountName}</FormError>
          )}
          {!formErrors.toAccountName && validationErrors.toAccountName && (
            <FormError>
              {Array.isArray(validationErrors.toAccountName)
                ? validationErrors.toAccountName[0]
                : String(validationErrors.toAccountName)}
            </FormError>
          )}

          {showToAccountCreation && (
            <AccountCreationForm onSuccess={handleToAccountCreated} />
          )}
        </div>
      </div>

      {/* Fourth row: Schedule Type and conditional Repeat Interval */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-schedule-type">Schedule Type</Label>
          <Select
            value={scheduleType}
            onValueChange={(value) => setScheduleType(value as ScheduleTypeEnum)}
          >
            <SelectTrigger 
              id="transfer-schedule-type"
              className={
                (formErrors.scheduleType || validationErrors.scheduleType)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            >
              <SelectValue placeholder="Select schedule type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ScheduleTypeEnum.ONE_TIME}>One Time</SelectItem>
              <SelectItem value={ScheduleTypeEnum.REPEAT}>Recurring</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.scheduleType && (
            <FormError>{formErrors.scheduleType}</FormError>
          )}
          {!formErrors.scheduleType && validationErrors.scheduleType && (
            <FormError>
              {Array.isArray(validationErrors.scheduleType)
                ? validationErrors.scheduleType[0]
                : String(validationErrors.scheduleType)}
            </FormError>
          )}
        </div>

        {scheduleType === ScheduleTypeEnum.REPEAT ? (
          <div className="space-y-2">
            <Label htmlFor="transfer-repeat-interval">Repeat Interval</Label>
            <Select
              value={repeatInterval}
              onValueChange={setRepeatInterval}
            >
              <SelectTrigger 
                id="transfer-repeat-interval"
                className={
                  (formErrors.repeatInterval || validationErrors.repeatInterval)
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              >
                <SelectValue placeholder="Select repeat interval" />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.repeatInterval && (
              <FormError>{formErrors.repeatInterval}</FormError>
            )}
            {!formErrors.repeatInterval && validationErrors.repeatInterval && (
              <FormError>
                {Array.isArray(validationErrors.repeatInterval)
                  ? validationErrors.repeatInterval[0]
                  : String(validationErrors.repeatInterval)}
              </FormError>
            )}
          </div>
        ) : <div></div>}
      </div>

      {/* Fifth row: Description */}
      <div className="space-y-2">
        <Label htmlFor="transfer-description">Description (Optional)</Label>
        <Input
          id="transfer-description"
          placeholder="Enter description"
          value={description || ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* File Upload Field */}
      <div className="space-y-2">
        <Label>Attach File (Optional)</Label>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => document.getElementById("expense-file-upload")?.click()}
        >
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-1" />
            <p className="text-sm text-gray-500">Drag & drop your file here or <span className="text-primary font-medium">browse files</span></p>
            <p className="text-xs text-gray-400 mt-1">Supports: JPG, PNG, PDF (Max 5MB)</p>
            {fileState && (<p className="text-sm text-green-600 mt-2">File selected: {fileState.name}</p>)}
          </div>
          <input
            id="expense-file-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-primary hover:bg-primary/80"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </>
          ) : (
            "Add Transfer"
          )}
        </Button>
      </div>
    </form>
  );
};

export default TransferForm;
