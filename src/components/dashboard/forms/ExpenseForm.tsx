import React, { useEffect, useState, useMemo } from "react";
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
import { Upload, CalendarIcon, Receipt } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Calendar } from "../../ui/calendar";
import { format, endOfMonth } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { expenseCategoryOptionsAtom, accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { 
  createCategoryAtom, 
  categoryValidationErrorsAtom
} from "@/atoms/transactionCategoryAtoms";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import * as z from "zod"; 
import { createTransaction, updateTransaction, deleteTransaction } from "@/services/transactions/mutation";
import { REPEAT_INTERVALS, ScheduleTypeEnum, TransactionTypeEnum, DeleteScopeEnum } from "@/constants/transactionConstants";
import AccountCreationForm from "./AccountCreationForm";
import CategoryCreationForm from "./CategoryCreationForm";
import { UpdateTransactionType } from "@/types/transactionTypes";
import ExpandableTextarea from '@/components/ui/expandable-textarea';
import FileUploadField from "./FileUploadField";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { createDisplayFileFromDraft } from "@/utils/fileUtils";
import { useTransactionDrafts } from "@/hooks/async/useTransactionDrafts";
import DraftItems from "./DraftItems";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";

// Keep Zod schemas as they are used by the adapter and nested forms
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

// Main expense form schema using Zod
const expenseFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Amount must be a positive number" }),
  description: z.string().optional(),
  categoryName: z.string().min(1, "Category is required"),
  accountName: z.string().min(1, "Account is required"),
  scheduleType: z.enum([
    ScheduleTypeEnum.ONE_TIME, 
    ScheduleTypeEnum.REPEAT, 
    ScheduleTypeEnum.INSTALLMENT
  ]),
  repeatInterval: z.string().optional(),
  // Ensure installmentPeriod is treated as a number for validation
  installmentPeriod: z.string().optional().refine((val) => !val || /^\d+$/.test(val), {
    message: "Installment period must be a whole number",
  }), 
  file: z.any().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scheduleType === ScheduleTypeEnum.REPEAT) {
    if (!data.repeatInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Repeat interval is required for recurring expenses",
        path: ["repeatInterval"]
      });
    }
  }
  if (data.scheduleType === ScheduleTypeEnum.INSTALLMENT) {
    const period = data.installmentPeriod ? parseInt(data.installmentPeriod, 10) : 0;
    if (isNaN(period) || period <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Number of months is required and must be positive for installment expenses",
        path: ["installmentPeriod"]
      });
    }
  }
});

// Type for TanStack Form values (derived from Zod schema)
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// Props remain largely the same, but adjusted for TanStack form conventions if needed
interface ExpenseFormProps {
  // Keep props for managing the UI state outside the form if necessary
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onAddCustomCategory?: (categoryName: string) => void;
  onAddCustomAccount?: (accountName: string) => void;
  onSubmitSuccess?: (data: any) => void; // Renamed for clarity
  onCancel?: () => void;
  formRef?: React.RefObject<HTMLFormElement | null>; // Keep if needed for external interaction
  // Edit mode props
  id?: string;
  initialData?: UpdateTransactionType & { draftId?: string };
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
}

// Main Expense Form using @tanstack/react-form
const ExpenseForm: React.FC<ExpenseFormProps> = ({
  date,
  setDate,
  onAddCustomCategory,
  onAddCustomAccount,
  onSubmitSuccess,
  onCancel,
  formRef,
  id,
  initialData,
  isEditMode = false,
  onFileUpdate,
}) => {
  // Get options from atoms
  const categoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const accountOptionsRaw = useAtomValue(accountOptionsAtom);
  
  // Deduplicate account options to prevent React key warnings
  const accountOptions = useMemo(() => {
    const seen = new Set();
    return accountOptionsRaw.filter(option => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [accountOptionsRaw]);
  
  const { api } = useAuthApi();

  // Local state for UI elements not directly part of the form data
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [showCustomAccountInput, setShowCustomAccountInput] = useState(false);
  // Removed fileState, will use formState.file directly
  const [scheduleType, setScheduleType] = useState<ScheduleTypeEnum>(
    initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reference to track when a new category or account is created
  const [refreshOptionsFlag, setRefreshOptionsFlag] = useState(0);
  
  // Track whether form has been submitted (for validation display)
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Form state management
  const [formState, setFormState] = useState<ExpenseFormValues>({
    amount: initialData?.amount?.toString() || "",
    description: initialData?.description || "",
    categoryName: initialData?.categoryName || "",
    accountName: initialData?.accountName || "",
    scheduleType: initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME,
    repeatInterval: initialData?.repeatInterval || "",
    installmentPeriod: initialData?.installmentPeriod?.toString() || "",
    file: initialData?.file || null,
  });
  
  // Number input hook for amount field
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => handleFieldChange("amount", cleanValue.toString())
  });
  
  // Store draftId separately since it's not part of the form values
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  
  // Store fileId separately for handling draft files
  const [fileId, setFileId] = useState<string | null>(null);
  
  // Draft functionality
  const [showDrafts, setShowDrafts] = useState(false);
  const { data: drafts = [], refetch: refetchDrafts } = useTransactionDrafts();
  const queryClient = useQueryClient();

  // Invalidate drafts query when form is loaded with initial data from Add Receipt
  useEffect(() => {
    if (initialData && initialData.draftId) {
      // When loading from Add Receipt with a draftId, invalidate the drafts query
      // to ensure we have the latest draft data
      queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
      console.log('Invalidated transactionDrafts query due to Add Receipt initial data');
    }
  }, [initialData?.draftId, queryClient]);
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  
  // Initialize formState from initialData
  const prevInitialDataRef = React.useRef<UpdateTransactionType | undefined>(initialData);

  useEffect(() => {
    // Only proceed if initialData is provided and is a different object reference
    if (initialData && (initialData !== prevInitialDataRef.current)) {
      
      // Update form state with all initialData values
      setFormState({
        amount: initialData.amount?.toString() || "",
        description: initialData.description || "",
        categoryName: initialData.categoryName || "",
        accountName: initialData.accountName || "",
        scheduleType: initialData.scheduleType || ScheduleTypeEnum.ONE_TIME,
        repeatInterval: initialData.repeatInterval || "",
        installmentPeriod: initialData.installmentPeriod?.toString() || "",
        file: initialData.file || null,
      });
      
      // Update number input hook
      amountInput.setDisplayValue(initialData.amount?.toString() || "");
      
      
      // Update schedule type state
      setScheduleType(initialData.scheduleType || ScheduleTypeEnum.ONE_TIME);
      
      // Update draftId
      setDraftId(initialData.draftId);

      // Update date when initialData changes
      if (initialData.date) {
        setDate(new Date(initialData.date));
      }

      // Store the current initialData reference to prevent re-running on same object
      prevInitialDataRef.current = initialData;
    } else if (!initialData && prevInitialDataRef.current) {
      // If initialData becomes undefined and it was previously set, clear the form
      setFormState({
        amount: "",
        description: "",
        categoryName: "",
        accountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        installmentPeriod: "",
        file: null,
      });
      // Reset number input hook
      amountInput.reset();
      setDate(undefined);
      setShowCustomCategoryInput(false);
      setShowCustomAccountInput(false);
      setScheduleType(ScheduleTypeEnum.ONE_TIME);
      setFormSubmitted(false);
      prevInitialDataRef.current = undefined;
    }
  }, [initialData, initialData?.file]); // Add initialData?.file to dependencies

  // Effect to force re-render when new categories or accounts are added
  useEffect(() => {
    // This dependency array includes categoryOptions and accountOptions
    // When they change (due to a new item being added), this comes in here
  }, [categoryOptions, accountOptions, refreshOptionsFlag]);
  
  // Form validation
  const validateForm = () => {
    try {
      expenseFormSchema.parse(formState);
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
  const handleFieldChange = (field: keyof ExpenseFormValues, value: any) => {
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
        amount: numberFormatting.cleanForBackend(formState.amount),
        description: formState.description || "",
        categoryName: formState.categoryName,
        accountName: formState.accountName,
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { 
          repeatInterval: formState.repeatInterval 
        }),
        ...(formState.scheduleType === ScheduleTypeEnum.INSTALLMENT && { 
          installmentPeriod: formState.installmentPeriod 
            ? parseInt(formState.installmentPeriod, 10) 
            : undefined 
        }),
        ...(fileId && { fileId }), // Use fileId if available from draft
        ...(formState.file && { file: formState.file }), // Use formState.file
        ...(draftId && { draftId }) // Include draftId if available
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
        toast.success("Expense created successfully");
      }
      
      // Call onSubmitSuccess callback to notify parent component
      if (onSubmitSuccess && !isEditMode) {
        onSubmitSuccess(response);
      }
      
      // Invalidate drafts query after successful submission
      queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
      console.log('Invalidated transactionDrafts query after successful submission');
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          description: "",
          categoryName: "",
          accountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          installmentPeriod: "",
          file: null, // Reset file in formState
        });
        // Reset number input hook
        amountInput.reset();
        setFileId(null);
        setDate(undefined);
        // setFileState(null); // Removed
        setShowCustomCategoryInput(false);
        setShowCustomAccountInput(false);
        setScheduleType(ScheduleTypeEnum.ONE_TIME);
        setFormSubmitted(false); // Reset the form submission flag
      }
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} expense:`, error);
      const fieldErrors = extractFieldErrors(error);
      
      toast.error(fieldErrors.detail || `Failed to ${isEditMode ? 'update' : 'create'} expense. Please try again.`);
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
    setFileId(null);
    if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
  };

  // Handle draft selection
  const handleDraftSelect = async (draft: any) => {
    console.log('Draft selected:', draft);
    
    // Handle file transfer from draft using the same logic as EditTransactionDialog
    let displayFile = null;
    let draftFileId = null;
    
    if (draft.files && draft.files.length > 0) {
      const firstFile = draft.files[0];
      console.log('First file from draft:', firstFile);
      
      // Use the reusable utility to create display file object
      displayFile = createDisplayFileFromDraft({
        id: firstFile.id,
        url: firstFile.url,
        name: firstFile.name || `receipt-${draft.id}.jpg`,
        contentType: firstFile.contentType || 'image/jpeg'
      });
      
      draftFileId = firstFile.id;
      
      console.log('Using fileId for draft file:', draftFileId);
      console.log('Created display file:', displayFile);
      toast.success('Draft file loaded successfully');
    } else {
      console.log('No files found in draft');
    }

    const newFormState = {
      amount: typeof draft.amount === 'number' ? draft.amount.toString() : String(draft.amount || ""),
      description: draft.description || "",
      categoryName: draft.categoryName || "",
      accountName: draft.accountName || "",
      scheduleType: draft.scheduleType || ScheduleTypeEnum.ONE_TIME,
      repeatInterval: draft.repeatInterval || "",
      installmentPeriod: draft.installmentPeriod?.toString() || "",
      file: displayFile, // Set the display file for preview
    };
    
    console.log('Setting new form state:', newFormState);
    setFormState(newFormState);
    
    // Set file ID for submission
    setFileId(draftFileId);
    
    // Notify parent with file info for preview
    if (onFileUpdate && displayFile) {
      console.log('Notifying parent of file info:', displayFile);
      onFileUpdate(displayFile);
    }
    
    if (draft.date) {
      setDate(new Date(draft.date));
    }
    
    setDraftId(draft.id);
    setShowDrafts(false);
  };

  // Handle drafts invalidation
  const handleDraftsInvalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
    console.log('Invalidated transactionDrafts query via handleDraftsInvalidate');
  };

  // Handle delete draft
  const handleDeleteDraft = async () => {
    if (!draftId) return;
    
    try {
      await deleteTransaction(api, { id: draftId, deleteScope: DeleteScopeEnum.THIS_ONLY });
      toast.success('Draft deleted successfully');
      
      // Reset form
      setFormState({
        amount: "",
        description: "",
        categoryName: "",
        accountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        installmentPeriod: "",
        file: null,
      });
      setFileId(null);
      setDate(new Date());
      setDraftId(undefined);
      
      // Notify parent of file removal
      if (onFileUpdate) {
        onFileUpdate(null);
      }
      
      // Invalidate drafts query
      handleDraftsInvalidate();
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  // Handle category creation
  const handleCategoryCreated = (categoryName: string) => {
    if (categoryName) {
      // Update the form state with the new category name
      handleFieldChange("categoryName", categoryName);
      
      // Notify parent component if callback provided
      if (onAddCustomCategory) onAddCustomCategory(categoryName);
      
      // Trigger a refresh of options
      setRefreshOptionsFlag(prev => prev + 1);
      
      
    }
    // Close the category creation form
    setShowCustomCategoryInput(false);
  };

  // Handle account creation
  const handleAccountCreated = (accountName: string) => {
    if (accountName) {
      // Update the form state with the new account name
      handleFieldChange("accountName", accountName);
      
      // Notify parent component if callback provided
      if (onAddCustomAccount) onAddCustomAccount(accountName);
      
      // Trigger a refresh of options
      setRefreshOptionsFlag(prev => prev + 1);
      
      
    }
    // Close the account creation form
    setShowCustomAccountInput(false);
  };

  const currentDate = new Date();
  const maxDate = endOfMonth(currentDate);
  
  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Receipt Drafts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDrafts(!showDrafts)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground hover:text-primary-foreground"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Receipt Drafts
            </Button>
            
            {draftId && (
              <Button
                variant="destructive"
                onClick={handleDeleteDraft}
                className="bg-destructive text-white hover:text-white"
              >
                Delete Draft
              </Button>
            )}
          </div>
          
          {showDrafts && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <DraftItems
                drafts={drafts.slice(0, 5)} // Show at most 5 drafts
                onDraftSelect={handleDraftSelect}
                onDraftsInvalidate={handleDraftsInvalidate}
              />
            </div>
          )}
        </div>

        {/* Date Picker */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm">Date</Label>
            <Popover modal>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="w-full justify-start text-left font-normal text-sm">
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
                  toDate={maxDate} 
                  defaultMonth={date || new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount Field */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm">Amount</Label>
            <Input
              id="amount"
              name="amount"
              value={amountInput.displayValue}
              onChange={(e) => amountInput.handleInputChange(e.target.value)}
              type="text"
              placeholder="0.00"
              className={`text-sm ${formSubmitted && formErrors.amount ? "border-red-800 focus-visible:ring-red-800" : ""}`}
            />
            {formSubmitted && formErrors.amount?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Schedule Type Field */}
          <div className="space-y-2">
            <Label htmlFor="scheduleType" className="text-sm">Schedule Type</Label>
            <Select
              value={formState.scheduleType}
              onValueChange={(value) => handleFieldChange("scheduleType", value)}
            >
              <SelectTrigger 
                id="scheduleType" 
                className={`text-sm ${formSubmitted && formErrors.scheduleType ? "border-red-800 focus-visible:ring-red-800" : ""}`}
              >
                <SelectValue placeholder="Select schedule type" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ScheduleTypeEnum.ONE_TIME} className="text-sm">One-Time</SelectItem>
                <SelectItem value={ScheduleTypeEnum.REPEAT} className="text-sm">Recurring</SelectItem>
                <SelectItem value={ScheduleTypeEnum.INSTALLMENT} className="text-sm">Installment</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.scheduleType?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {/* Conditional Fields */}
            {scheduleType === ScheduleTypeEnum.REPEAT && (
              <div className="mt-3">
                <Label htmlFor="repeatInterval" className="text-sm">Repeat Interval</Label>
                <Select
                  value={formState.repeatInterval || ""}
                  onValueChange={(value) => handleFieldChange("repeatInterval", value)}
                >
                  <SelectTrigger 
                    id="repeatInterval" 
                    className={`text-sm ${formSubmitted && formErrors.repeatInterval ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  >
                    <SelectValue placeholder="Select interval" className="text-sm" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_INTERVALS.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-sm">{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && formErrors.repeatInterval?.map((error) => (
                  <FormError key={error}>{error}</FormError>
                ))}
              </div>
            )}
            
            {scheduleType === ScheduleTypeEnum.INSTALLMENT && (
              <div className="mt-3">
                <Label htmlFor="installmentPeriod" className="text-sm">Number of Months</Label>
                <Input
                  id="installmentPeriod"
                  name="installmentPeriod"
                  value={formState.installmentPeriod || ""}
                  onChange={(e) => handleFieldChange("installmentPeriod", e.target.value)}
                  type="number"
                  placeholder="Number of months"
                  className={`text-sm ${formSubmitted && formErrors.installmentPeriod ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                {formSubmitted && formErrors.installmentPeriod?.map((error) => (
                  <FormError key={error}>{error}</FormError>
                ))}
              </div>
            )}
          </div>
          
          {/* Category Field */}
          <div className="space-y-2">
            <Label htmlFor="categoryName" className="text-sm">Expense Category</Label>
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
                className={`text-sm ${formSubmitted && formErrors.categoryName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
              >
                <SelectValue placeholder="Select category" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-sm">
                    {cat.label}
                  </SelectItem>
                ))}
                <SelectItem value="add_category" className="text-sm">+ Add Expense Category</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.categoryName?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {showCustomCategoryInput && (
              <CategoryCreationForm 
                onSuccess={handleCategoryCreated}
                categoryType={CategoryTypeEnum.EXPENSE}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Account Field */}
          <div className="space-y-2">
            <Label htmlFor="accountName" className="text-sm">Account</Label>
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
                className={`text-sm ${formSubmitted && formErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
              >
                <SelectValue placeholder="Select Account" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((acc) => (
                  <SelectItem key={acc.value} value={acc.value} className="text-sm">
                    {acc.label}
                  </SelectItem>
                ))}
                <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
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
          <div className="w-full">
            <Label htmlFor="description" className="text-sm">Note (Optional)</Label>
            <ExpandableTextarea
              id="description"
              value={formState.description || ""}
              onChange={e => handleFieldChange("description", e.target.value)}
              placeholder="Add additional details"
              className="mt-1"
            />
          </div>
        </div>

        {/* File Upload Field */}
        <FileUploadField
          file={formState.file}
          onFileChange={handleFileChange}
          onRemoveFile={handleRemoveFile}
        />

      </div>
      {/* Submit/Cancel Buttons */}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="text-sm">
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-primary hover:bg-primary/80 text-sm" 
          disabled={isSubmitting}
        >
          {isSubmitting ? (isEditMode ? "Updating Expense..." : "Adding Expense...") : (isEditMode ? "Update Expense" : "Add Expense")}
        </Button>
      </div>
    </form>
  );
};

export default ExpenseForm;
