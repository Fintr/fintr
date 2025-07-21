import React, { useState, useEffect } from "react";
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
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { createTransfer } from "@/services/transactions/transfers/mutation";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { FormError } from "@/components/ui/form-error";
import * as z from "zod";
import { ScheduleTypeEnum, REPEAT_INTERVALS } from "@/constants/transactionConstants";
import AccountCreationForm from "./AccountCreationForm";
import { updateTransfer, UpdateTransferType } from "@/services/transactions/transfers/mutation";

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
  
  // Form state management using local state
  const [formState, setFormState] = useState({
    amount: "",
    transactionCost: "",
    description: "",
    fromAccountName: "",
    toAccountName: "",
    scheduleType: ScheduleTypeEnum.ONE_TIME,
    repeatInterval: "",
  });
  
  // Track form submission state
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Local state
  const [fileState, setFileState] = useState<File | null>(null);
  const [showFromAccountCreation, setShowFromAccountCreation] = useState(false);
  const [showToAccountCreation, setShowToAccountCreation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Handle field changes
  const handleFieldChange = (field: keyof typeof formState, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // If form has been submitted once, validate on change to provide immediate feedback
    if (formSubmitted) {
      validateForm();
    }
  };
  
  // Validate form using Zod
  const validateForm = () => {
    try {
      // Prepare form data with appropriate handling for transactionCost default
      const formData = {
        amount: formState.amount,
        transactionCost: formState.transactionCost,
        fromAccountName: formState.fromAccountName,
        toAccountName: formState.toAccountName,
        description: formState.description,
        scheduleType: formState.scheduleType,
        // Include repeatInterval only if scheduleType is REPEAT
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval: formState.repeatInterval })
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
    
    // Mark form as submitted to show validation errors
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }
    
    if (!date) {
      toast.error("Please select a date for the transfer");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const transferData = {
        amount: parseFloat(formState.amount),
        transactionCost: formState.transactionCost && formState.transactionCost.trim() !== '' ? parseFloat(formState.transactionCost) : 0,
        fromAccountName: formState.fromAccountName,
        toAccountName: formState.toAccountName,
        description: formState.description || '',
        date: format(date, 'yyyy-MM-dd'),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval: formState.repeatInterval }),
        file: fileState ?? undefined
      };
      
      let response;
      
      // Create new transfer
      response = await createTransfer(api, transferData);
      toast.success(`Transfer of ${transferData.amount} from ${transferData.fromAccountName} to ${transferData.toAccountName} has been recorded.`);
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      setFormState({
        amount: "",
        transactionCost: "",
        description: "",
        fromAccountName: "",
        toAccountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
      });
      setFileState(null);
      setFormSubmitted(false);
      
      // Notify parent components of success
      onSubmitSuccess(response);
    } catch (error) {
      console.error(`Error creating transfer:`, error);
      toast.error(`Failed to create transfer. Please try again.`);
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
      handleFieldChange("fromAccountName", accountName);
    }
    setShowFromAccountCreation(false);
  };
  
  const handleToAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("toAccountName", accountName);
    }
    setShowToAccountCreation(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* First row: Date (50% width) */}
      <div className="flex">
        <div className="space-y-2 w-1/2">
          <Label htmlFor="transfer-date" className="text-sm">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={"outline"}
                className={`w-full justify-start text-left font-normal text-sm`}
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
      </div>

      {/* Second row: Amount and Transaction Cost */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-amount" className="text-sm">Amount</Label>
          <Input
            id="transfer-amount"
            type="text" 
            value={formState.amount}
            placeholder="0.00"
            onChange={(e) => handleFieldChange("amount", e.target.value)}
            className={`text-sm ${
              (formSubmitted && formErrors.amount)
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }`}
          />
          {formSubmitted && formErrors.amount && (
            <FormError>{formErrors.amount}</FormError>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-transaction-cost" className="text-sm">Transaction Cost</Label>
          <Input
            id="transfer-transaction-cost"
            type="text" 
            value={formState.transactionCost}
            placeholder="0.00"
            onChange={(e) => handleFieldChange("transactionCost", e.target.value)}
            className={`text-sm ${
              (formSubmitted && formErrors.transactionCost)
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
            }`}
          />
          {formSubmitted && formErrors.transactionCost && (
            <FormError>{formErrors.transactionCost}</FormError>
          )}
        </div>
      </div>

      {/* Third row: From Account and To Account */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-from" className="text-sm">From Account</Label>
          <Select
            value={formState.fromAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowFromAccountCreation(true);
                handleFieldChange("fromAccountName", "");
              } else {
                setShowFromAccountCreation(false);
                handleFieldChange("fromAccountName", value);
              }
            }}
          >
            <SelectTrigger 
              id="transfer-from"
              className={`text-sm ${
                (formSubmitted && formErrors.fromAccountName)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select account" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.fromAccountName && (
            <FormError>{formErrors.fromAccountName}</FormError>
          )}

          {showFromAccountCreation && (
            <AccountCreationForm onSuccess={handleFromAccountCreated} />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-to" className="text-sm">To Account</Label>
          <Select
            value={formState.toAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowToAccountCreation(true);
                handleFieldChange("toAccountName", "");
              } else {
                setShowToAccountCreation(false);
                handleFieldChange("toAccountName", value);
              }
            }}
          >
            <SelectTrigger 
              id="transfer-to"
              className={`text-sm ${
                (formSubmitted && formErrors.toAccountName)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select account" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.toAccountName && (
            <FormError>{formErrors.toAccountName}</FormError>
          )}

          {showToAccountCreation && (
            <AccountCreationForm onSuccess={handleToAccountCreated} />
          )}
        </div>
      </div>

      {/* Fourth row: Schedule Type and conditional Repeat Interval */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-schedule-type" className="text-sm">Schedule Type</Label>
          <Select
            value={formState.scheduleType}
            onValueChange={(value) => handleFieldChange("scheduleType", value as ScheduleTypeEnum)}
          >
            <SelectTrigger 
              id="transfer-schedule-type"
              className={`text-sm ${
                (formSubmitted && formErrors.scheduleType)
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select schedule type" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ScheduleTypeEnum.ONE_TIME} className="text-sm">One Time</SelectItem>
              <SelectItem value={ScheduleTypeEnum.REPEAT} className="text-sm">Recurring</SelectItem>
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.scheduleType && (
            <FormError>{formErrors.scheduleType}</FormError>
          )}
        </div>

        {formState.scheduleType === ScheduleTypeEnum.REPEAT ? (
          <div className="space-y-2">
            <Label htmlFor="transfer-repeat-interval" className="text-sm">Repeat Interval</Label>
            <Select
              value={formState.repeatInterval}
              onValueChange={(value) => handleFieldChange("repeatInterval", value)}
            >
              <SelectTrigger 
                id="transfer-repeat-interval"
                className={`text-sm ${
                  (formSubmitted && formErrors.repeatInterval)
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
              >
                <SelectValue placeholder="Select repeat interval" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value} className="text-sm">
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.repeatInterval && (
              <FormError>{formErrors.repeatInterval}</FormError>
            )}
          </div>
        ) : <div className="text-sm"></div>}
      </div>

      {/* Fifth row: Description */}
      <div className="space-y-2">
        <Label htmlFor="transfer-description" className="text-sm">Description (Optional)</Label>
        <Input
          id="transfer-description"
          placeholder="Enter description"
          value={formState.description || ""}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          className="text-sm"
        />
      </div>

      {/* File Upload Field */}
      <div className="space-y-2">
        <Label className="text-sm">Attach File (Optional)</Label>
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
        <Button type="button" variant="outline" onClick={onCancel} className="text-sm">
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-primary hover:bg-primary/80 text-sm"
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
