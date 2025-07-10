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
import { format, endOfMonth } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { incomeCategoryOptionsAtom, accountOptionsAtom } from "@/atoms/dashboardAtoms";
import * as z from "zod"; 
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { createTransaction, updateTransaction } from "@/services/transactions/mutation";
import { REPEAT_INTERVALS, ScheduleTypeEnum, TransactionTypeEnum } from "@/constants/transactionConstants";
import AccountCreationForm from "./AccountCreationForm";
import CategoryCreationForm from "./CategoryCreationForm";
import { UpdateTransactionType } from "@/types/transactionTypes";

// Income form schema using Zod
const incomeFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Amount must be a positive number" }),
  description: z.string().optional(),
  categoryName: z.string().min(1, "Category is required"),
  accountName: z.string().min(1, "Account is required"),
  scheduleType: z.enum([
    ScheduleTypeEnum.ONE_TIME, 
    ScheduleTypeEnum.REPEAT
  ]),
  repeatInterval: z.string().optional(),
  file: z.any().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scheduleType === ScheduleTypeEnum.REPEAT) {
    if (!data.repeatInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Repeat interval is required for recurring income",
        path: ["repeatInterval"]
      });
    }
  }
});

// Type for form values (derived from Zod schema)
type IncomeFormValues = z.infer<typeof incomeFormSchema>;

// Props for IncomeForm
interface IncomeFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onAddCustomCategory?: (categoryName: string) => void;
  onAddCustomAccount?: (accountName: string) => void;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  formRef?: React.RefObject<HTMLFormElement>;
  // Edit mode props
  id?: string;
  initialData?: UpdateTransactionType;
  isEditMode?: boolean;
}

// Main Income Form
const IncomeForm: React.FC<IncomeFormProps> = ({
  date,
  setDate,
  onAddCustomCategory,
  onAddCustomAccount,
  onSubmitSuccess,
  onCancel,
  formRef,
  id,
  initialData = {} as UpdateTransactionType,
  isEditMode = false,
}) => {
  const categoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const accountOptions = useAtomValue(accountOptionsAtom);
  const { api } = useAuthApi();

  // Local state for UI elements and form handling
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [showCustomAccountInput, setShowCustomAccountInput] = useState(false);
  const [fileState, setFileState] = useState<File | null>(null);
  const [scheduleType, setScheduleType] = useState<ScheduleTypeEnum>(
    (initialData?.scheduleType === ScheduleTypeEnum.REPEAT) 
      ? ScheduleTypeEnum.REPEAT 
      : ScheduleTypeEnum.ONE_TIME
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track whether form has been submitted (for validation display)
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Form state management
  const [formState, setFormState] = useState<IncomeFormValues>({
    amount: initialData?.amount?.toString() || "",
    description: initialData?.description || "",
    categoryName: initialData?.categoryName || "",
    accountName: initialData?.accountName || "",
    scheduleType: (initialData?.scheduleType === ScheduleTypeEnum.REPEAT) 
      ? ScheduleTypeEnum.REPEAT 
      : ScheduleTypeEnum.ONE_TIME,
    repeatInterval: initialData?.repeatInterval || "",
    file: initialData?.file || null,
  });
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  
  // Form validation
  const validateForm = () => {
    try {
      incomeFormSchema.parse(formState);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          if (!errors[path]) errors[path] = [];
          errors[path].push(err.message);
        });
        setFormErrors(errors);
      }
      return false;
    }
  };
  
  // Handle field changes
  const handleFieldChange = (field: keyof IncomeFormValues, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // Special handling for schedule type
    if (field === "scheduleType") {
      setScheduleType(value as ScheduleTypeEnum);
    }
    
    // If form has been submitted once, validate on change to provide immediate feedback
    if (formSubmitted) {
      validateForm();
    }
  };
  
  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark form as submitted to show validation errors
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    if (!date) {
      toast.error("Please select a date");
      setIsSubmitting(false);
      return;
    }
    
    try {
      const transactionData = {
        amount: parseFloat(formState.amount),
        description: formState.description || "",
        categoryName: formState.categoryName,
        accountName: formState.accountName,
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { 
          repeatInterval: formState.repeatInterval 
        }),
        ...(fileState && { file: fileState })
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transaction - pass the data to parent for scope handling
        const submitData = { ...transactionData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess?.(submitData);
        return; // Let parent handle the actual update
      } else {
        // Create new transaction
        response = await createTransaction(api, transactionData);
        toast.success("Income created successfully");
      }
      
      // Call onSubmitSuccess callback to notify parent component
      if (onSubmitSuccess && !isEditMode) {
        onSubmitSuccess(response);
      }
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          description: "",
          categoryName: "",
          accountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          file: null,
        });
        setDate(undefined);
        setFileState(null);
        setShowCustomCategoryInput(false);
        setShowCustomAccountInput(false);
        setScheduleType(ScheduleTypeEnum.ONE_TIME);
        setFormSubmitted(false); // Reset the form submission flag
      }
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} income:`, error);
      const fieldErrors = extractFieldErrors(error);
      
      toast.error(fieldErrors.detail || `Failed to ${isEditMode ? 'update' : 'create'} income. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileState(file);
    } else {
      setFileState(null);
    }
  };

  // Handle category creation
  const handleCategoryCreated = (categoryName: string) => {
    if (categoryName) {
      handleFieldChange("categoryName", categoryName);
      if (onAddCustomCategory) onAddCustomCategory(categoryName);
    }
    setShowCustomCategoryInput(false);
  };

  // Handle account creation
  const handleAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("accountName", accountName);
      if (onAddCustomAccount) onAddCustomAccount(accountName);
    }
    setShowCustomAccountInput(false);
  };

  const currentDate = new Date();
  const maxDate = endOfMonth(currentDate);
  
  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Date Picker */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "MMMM d, yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus toDate={maxDate} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount Field */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              value={formState.amount}
              onChange={(e) => handleFieldChange("amount", e.target.value)}
              type="number"
              placeholder="0.00"
              className={formSubmitted && formErrors.amount ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {formSubmitted && formErrors.amount?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Schedule Type Field */}
          <div className="space-y-2">
            <Label htmlFor="scheduleType">Schedule Type</Label>
            <Select
              value={formState.scheduleType}
              onValueChange={(value) => handleFieldChange("scheduleType", value)}
            >
              <SelectTrigger 
                id="scheduleType" 
                className={formSubmitted && formErrors.scheduleType ? "border-red-500 focus-visible:ring-red-500" : ""}
              >
                <SelectValue placeholder="Select schedule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ScheduleTypeEnum.ONE_TIME}>One-Time</SelectItem>
                <SelectItem value={ScheduleTypeEnum.REPEAT}>Recurring</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.scheduleType?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {/* Repeat Interval - only show for recurring income */}
            {scheduleType === ScheduleTypeEnum.REPEAT && (
              <div className="mt-3">
                <Label htmlFor="repeatInterval">Repeat Interval</Label>
                <Select
                  value={formState.repeatInterval || ""}
                  onValueChange={(value) => handleFieldChange("repeatInterval", value)}
                >
                  <SelectTrigger 
                    id="repeatInterval" 
                    className={formSubmitted && formErrors.repeatInterval ? "border-red-500 focus-visible:ring-red-500" : ""}
                  >
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_INTERVALS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && formErrors.repeatInterval?.map((error) => (
                  <FormError key={error}>{error}</FormError>
                ))}
              </div>
            )}
          </div>
          
          {/* Category Field */}
          <div className="space-y-2">
            <Label htmlFor="categoryName">Income Category</Label>
            <Select
              value={formState.categoryName}
              onValueChange={(value) => {
                if (value === "add_category") {
                  setShowCustomCategoryInput(true);
                } else {
                  setShowCustomCategoryInput(false);
                  handleFieldChange("categoryName", value);
                }
              }}
            >
              <SelectTrigger 
                id="categoryName" 
                className={formSubmitted && formErrors.categoryName ? "border-red-500 focus-visible:ring-red-500" : ""}
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
                <SelectItem value="add_category">+ Add Income Category</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.categoryName?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {showCustomCategoryInput && (
              <CategoryCreationForm 
                onSuccess={handleCategoryCreated}
                categoryType={TransactionTypeEnum.INCOME}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Account Field */}
          <div className="space-y-2">
            <Label htmlFor="accountName">Account</Label>
            <Select
              value={formState.accountName}
              onValueChange={(value) => {
                if (value === "add_account") {
                  setShowCustomAccountInput(true);
                } else {
                  setShowCustomAccountInput(false);
                  handleFieldChange("accountName", value);
                }
              }}
            >
              <SelectTrigger 
                id="accountName" 
                className={formSubmitted && formErrors.accountName ? "border-red-500 focus-visible:ring-red-500" : ""}
              >
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((acc) => (
                  <SelectItem key={acc.value} value={acc.value}>
                    {acc.label}
                  </SelectItem>
                ))}
                <SelectItem value="add_account">+ Add Account</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.accountName?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {showCustomAccountInput && (
              <AccountCreationForm onSuccess={handleAccountCreated} />
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Note (Optional)</Label>
            <Input
              id="description"
              name="description"
              value={formState.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Add additional details"
            />
          </div>
        </div>

        {/* File Upload Field */}
        <div className="space-y-2">
          <Label>Attach File (Optional)</Label>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => document.getElementById("income-file-upload")?.click()}
          >
            <div className="flex flex-col items-center">
              <Upload className="h-8 w-8 text-gray-400 mb-1" />
              <p className="text-sm text-gray-500">Drag & drop your file here or <span className="text-primary font-medium">browse files</span></p>
              <p className="text-xs text-gray-400 mt-1">Supports: JPG, PNG, PDF (Max 5MB)</p>
              {fileState && (<p className="text-sm text-green-600 mt-2">File selected: {fileState.name}</p>)}
            </div>
            <input
              id="income-file-upload"
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Submit/Cancel Buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/80" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (isEditMode ? "Updating Income..." : "Adding Income...") : (isEditMode ? "Update Income" : "Add Income")}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default IncomeForm;
