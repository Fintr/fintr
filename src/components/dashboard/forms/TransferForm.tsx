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
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import FileUploadField from "./FileUploadField";

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
  id?: string;
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  // Edit mode props
  initialData?: UpdateTransferType;
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
}

const TransferForm: React.FC<TransferFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
  id,
  initialData,
  isEditMode = false,
  onFileUpdate,
}) => {
  const { api } = useAuthApi();
  const accountOptions = useAtomValue(accountOptionsAtom);
  
  // Form state management using local state
  const [formState, setFormState] = useState({
    amount: initialData?.amount?.toString() || "",
    transactionCost: initialData?.transactionCost?.toString() || "",
    description: initialData?.description || "",
    fromAccountName: initialData?.fromAccountName || "",
    toAccountName: initialData?.toAccountName || "",
    scheduleType: initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME,
    repeatInterval: initialData?.repeatInterval || "",
    file: initialData?.file || null, // Add file state to formState
  });
  
  // Track form submission state
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Initialize formState from initialData
  const prevInitialDataRef = React.useRef<UpdateTransferType | undefined>(initialData);

  useEffect(() => {
    // Only proceed if initialData is provided and is a different object reference
    if (initialData && (initialData !== prevInitialDataRef.current)) {
      // Update form state with all initialData values
      setFormState({
        amount: initialData.amount?.toString() || "",
        transactionCost: initialData.transactionCost?.toString() || "",
        description: initialData.description || "",
        fromAccountName: initialData.fromAccountName || "",
        toAccountName: initialData.toAccountName || "",
        scheduleType: initialData.scheduleType || ScheduleTypeEnum.ONE_TIME,
        repeatInterval: initialData.repeatInterval || "",
        file: initialData.file || null, // Update file state
      });

      // Store the current initialData reference to prevent re-running on same object
      prevInitialDataRef.current = initialData;
    } else if (!initialData && prevInitialDataRef.current) {
      // If initialData becomes undefined and it was previously set, clear the form
      setFormState({
        amount: "",
        transactionCost: "",
        description: "",
        fromAccountName: "",
        toAccountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        file: null, // Clear file state
      });
      if (setDate) setDate(undefined); // Conditionally call setDate
      setShowFromAccountCreation(false);
      setShowToAccountCreation(false);
      setFormSubmitted(false);
      prevInitialDataRef.current = undefined;
    }
  }, [initialData, initialData?.file]); // Add initialData?.file to dependencies
  
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
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval: formState.repeatInterval }),
        file: fileState ?? undefined // Use fileState for validation
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
        file: formState.file ?? undefined // Use formState.file for submission
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transfer - pass the data to parent for scope handling
        const submitData = { ...transferData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess(submitData);
        return; // Let parent handle the actual update
      } else {
        // Create new transfer
        response = await createTransfer(api, transferData);
        toast.success(`Transfer of ${transferData.amount} from ${transferData.fromAccountName} to ${transferData.toAccountName} has been recorded.`);
      }
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          transactionCost: "",
          description: "",
          fromAccountName: "",
          toAccountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          file: null, // Clear file state on success
        });
        // setFileState(null);
        setFormSubmitted(false);
      }
      
      // Notify parent components of success
      if (!isEditMode) {
        onSubmitSuccess(response);
      }
    } catch (error) {
      toast.error(`Failed to create transfer. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormState(prev => ({ ...prev, file }));
      if (onFileUpdate) onFileUpdate(file); // Notify parent of file change
    } else {
      setFormState(prev => ({ ...prev, file: null }));
      if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setFormState(prev => ({ ...prev, file: null }));
    if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
  };

  // Handle account creation
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
                {date ? format(date, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                defaultMonth={date || new Date()}
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
                ? "border-red-800 focus-visible:ring-red-800"
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
                ? "border-red-800 focus-visible:ring-red-800"
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
                  ? "border-red-800 focus-visible:ring-red-800"
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
                  ? "border-red-800 focus-visible:ring-red-800"
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
                  ? "border-red-800 focus-visible:ring-red-800"
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
                    ? "border-red-800 focus-visible:ring-red-800"
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
      <div className="w-full">
        <Label htmlFor="transfer-description" className="text-sm">Description (Optional)</Label>
        <ExpandableTextarea
          id="transfer-description"
          placeholder="Enter description"
          value={formState.description || ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange("description", e.target.value)}
          className="mt-1"
        />
      </div>

      {/* File Upload Field */}
      <FileUploadField
        file={formState.file}
        onFileChange={handleFileChange}
        onRemoveFile={handleRemoveFile}
      />

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
              {isEditMode ? "Updating..." : "Adding..."}
            </>
          ) : (
            isEditMode ? "Update Transfer" : "Add Transfer"
          )}
        </Button>
      </div>
    </form>
  );
};

export default TransferForm;
