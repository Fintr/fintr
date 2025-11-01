import React, { useState, useEffect } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import ExpenseForm from "./ExpenseForm";
import IncomeForm from "./IncomeForm";
import TransferForm from "./TransferForm";
import ScopeModal, { UpdateScope, Scope } from "./ScopeModal";
import { IndexTransaction, CombinedTransactionTypeEnum, TransferUpdateTransactionType, UpdateTransactionType } from "@/types/transactionTypes";
import { UpdateTransferType, updateTransfer } from "@/services/transactions/transfers/mutation";
import { updateTransaction } from "@/services/transactions/mutation";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import { useAuthApi } from "@/hooks/useAuthApi";
import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { createDisplayFileFromAttachment } from "@/utils/fileUtils";

interface FileAttachment {
  id: string;
  filename: string;
  contentType: string;
  url: string;
  createdAt: string;
}

interface EditTransactionDialogProps {
  transaction: IndexTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [fullTransactionData, setFullTransactionData] = useState<UpdateTransactionType | TransferUpdateTransactionType | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { api } = useAuthApi();
  const [isLoading, setIsLoading] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  
  // Update scope modal state
  const [showUpdateScopeModal, setShowUpdateScopeModal] = useState(false);
  const [updateScope, setUpdateScope] = useState<UpdateScope>(UpdateScopeEnum.THIS_ONLY);
  const [scheduleTypeChange, setScheduleTypeChange] = useState<{from: string; to: string} | null>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false);
  const [dataKey, setDataKey] = useState<number>(0); // Add a key to force re-render

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      if (!transaction?.id || !api || !isOpen) return; // Only fetch if dialog is open, transaction exists, and api is ready

      setIsLoading(true);
      try {
        let data;
        
        // Use the appropriate endpoint based on transaction type
        if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
          data = await fetchTransferById(api, transaction.id);
        } else {
          data = await fetchTransactionById(api, transaction.id);
        }
        
        let processedData = { ...data }; // Create a mutable copy

        // Process file attachments if they exist AND no file is already set (e.g., from a new selection)
        if (processedData.files && Array.isArray(processedData.files) && processedData.files.length > 0 && !processedData.file) {
          setFileAttachments(processedData.files);
          
          // Create a special file object that works with the form components
          const fileAttachment = processedData.files[0];
          if (fileAttachment && fileAttachment.url) {
            // Use the reusable utility to create display file object
            const customFile = createDisplayFileFromAttachment(fileAttachment);
            
            // Add the custom file to the transaction data
            processedData.file = customFile;
            
          }
        }
        
        setFullTransactionData(processedData);
        setDataKey(prev => prev + 1); // Increment key to force re-render
        
        // Set the date from the transaction data
        if (processedData.date) {
          // Create a clean UTC date without time components to avoid timezone issues
          const dateObj = new Date(processedData.date);
          const cleanDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
          setDate(cleanDate);
        }
      } catch (error) {
        toast.error("Failed to fetch transaction details.");
        console.error(error);
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && transaction) {
      fetchTransactionDetails();
    } else {
      // Reset data when dialog is closed or transaction is null
      setFullTransactionData(null);
      setDate(new Date());
      setShowUpdateScopeModal(false);
      setScheduleTypeChange(null);
      setPendingFormData(null);
      setHasScheduleChanges(false);
      setFileAttachments([]);
      setDataKey(0); // Reset dataKey when closing
    }
  }, [transaction?.id, isOpen, api]); // Simplified dependencies for better control

  const validateScheduleTypeChange = (originalScheduleType: ScheduleTypeEnum, newScheduleType: ScheduleTypeEnum) => {
    // Rule 2: Cannot change from one_time or repeat to installment
    if ((originalScheduleType === ScheduleTypeEnum.ONE_TIME || originalScheduleType === ScheduleTypeEnum.REPEAT) && 
        newScheduleType === ScheduleTypeEnum.INSTALLMENT) {
      toast.error("Cannot change transaction to installment type. Please delete this transaction and create a new installment transaction instead.");
      return false;
    }

    // Rule 3: Cannot change from installment to anything else
    if (originalScheduleType === ScheduleTypeEnum.INSTALLMENT && newScheduleType !== ScheduleTypeEnum.INSTALLMENT) {
      toast.error("Cannot change installment transaction type. Please delete this transaction and create a new transaction instead.");
      return false;
    }

    return true;
  };

  const detectScheduleChanges = (originalData: UpdateTransactionType, newData: any) => {
    // Check if schedule-related fields have changed
    const scheduleFieldsChanged = 
      originalData.scheduleType !== newData.scheduleType ||
      originalData.repeatInterval !== newData.repeatInterval ||
      (
        (originalData.installmentPeriod !== newData.installmentPeriod) && 
        (![null, undefined].includes(newData.installmentPeriod))
      );
    return scheduleFieldsChanged;
  };

  const handleFormSubmit = (formData: any) => {
    if (!fullTransactionData) return;

    const originalScheduleType = fullTransactionData.scheduleType;
    const newScheduleType = formData.scheduleType;

    // Validate schedule type changes
    if (!validateScheduleTypeChange(originalScheduleType, newScheduleType)) {
      return;
    }

    // Detect if schedule-related changes were made
    const hasScheduleFieldChanges = detectScheduleChanges(fullTransactionData, formData);
    setHasScheduleChanges(hasScheduleFieldChanges);

    // Check if schedule type changed
    if (originalScheduleType !== newScheduleType) {
      // Rule 1: one_time to repeat - automatically set this_and_future
      if (originalScheduleType === ScheduleTypeEnum.ONE_TIME && newScheduleType === ScheduleTypeEnum.REPEAT) {
        const finalFormData = { ...formData, updateScope: UpdateScopeEnum.THIS_AND_FUTURE };
        handleSuccess(finalFormData);
        return;
      }

      // Rule 4: repeat to one_time - show modal with only this_and_future option
      if (originalScheduleType === ScheduleTypeEnum.REPEAT && newScheduleType === ScheduleTypeEnum.ONE_TIME) {
        setScheduleTypeChange({ from: "repeat", to: "one_time" });
        setUpdateScope(UpdateScopeEnum.THIS_AND_FUTURE); // Force this option
        setPendingFormData(formData);
        setShowUpdateScopeModal(true);
        return;
      }
    }

    // Check if this is a recurring transaction (repeat) - show modal for any changes
    if (originalScheduleType === ScheduleTypeEnum.REPEAT) {
      setScheduleTypeChange({ from: "repeat", to: "repeat" });
      setUpdateScope(UpdateScopeEnum.THIS_ONLY); // Default selection
      setPendingFormData(formData);
      setShowUpdateScopeModal(true);
      return;
    }

    // Check if this is an installment transaction - show modal for any changes
    if (originalScheduleType === ScheduleTypeEnum.INSTALLMENT) {
      setScheduleTypeChange({ from: "installment", to: "installment" });
      setUpdateScope(UpdateScopeEnum.THIS_ONLY); // Default selection
      setPendingFormData(formData);
      setShowUpdateScopeModal(true);
      return;
    }

    // If no schedule type change or one_time transaction, proceed directly
    handleSuccess(formData);
  };

  const handleUpdateScopeConfirm = (scope: Scope) => {
    if (pendingFormData) {
      const finalFormData = { ...pendingFormData, updateScope: scope as UpdateScope };
      handleSuccess(finalFormData);
    }
    setShowUpdateScopeModal(false);
    setPendingFormData(null);
    setScheduleTypeChange(null);
    setHasScheduleChanges(false);
  };

  const handleUpdateScopeChange = (scope: Scope) => {
    setUpdateScope(scope as UpdateScope);
  };

  const handleUpdateScopeCancel = () => {
    setShowUpdateScopeModal(false);
    setPendingFormData(null);
    setScheduleTypeChange(null);
    setHasScheduleChanges(false);
  };

  // Handle file updates from child forms
  const handleFileUpdate = (updatedFile: File | null) => {
    setFullTransactionData(prev => {
      if (!prev) return null;
      const newState = { ...prev, file: updatedFile };
      return newState;
    });
  };

  const handleSuccess = async (data: any) => {
    try {
      let response;
      
      // Ensure the file is included in the data object if it exists or is explicitly null (for removal)
      const dataWithFile = { ...data };
      
      // If the incoming data has a file (either new or existing), use it.
      // If it's null, it means the user removed the file.
      // If it's undefined, it means no change to the file was made in the form
      if (data.hasOwnProperty('file')) {
        dataWithFile.file = data.file;
      }

      if (transaction?.type === CombinedTransactionTypeEnum.TRANSFER) {
        response = await updateTransfer(api, dataWithFile);
        toast.success("Transfer updated successfully");
      } else {
        response = await updateTransaction(api, dataWithFile);
        toast.success("Transaction updated successfully");
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Failed to update transaction. Please try again.");
    }
  };

  const getDialogTitle = () => {
    switch (transaction?.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return "Edit Expense";
      case CombinedTransactionTypeEnum.INCOME:
        return "Edit Income";
      case CombinedTransactionTypeEnum.TRANSFER:
        return "Edit Transfer";
      default:
        return "Edit Transaction";
    }
  };

  const getDialogDescription = () => {
    switch (transaction?.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return "Update the details of your expense transaction.";
      case CombinedTransactionTypeEnum.INCOME:
        return "Update the details of your income transaction.";
      case CombinedTransactionTypeEnum.TRANSFER:
        return "Update the details of your transfer transaction.";
      default:
        return "Update the details of your transaction.";
    }
  };

  const renderForm = () => {
    if (isLoading) {
      return (
        <div className="py-8 text-center">
          <LoadingSpinner size="large" />
        </div>
      );
    }

    if (!fullTransactionData || !transaction) {
      return <div className="py-8 text-center">No transaction data available</div>;
    }

    // Use the key to force re-render when data changes
    switch (transaction.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return (
          <ExpenseForm
            key={`expense-form-${dataKey}`}
            id={transaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
          />
        );
      case CombinedTransactionTypeEnum.INCOME:
        return (
          <IncomeForm
            key={`income-form-${dataKey}`}
            id={transaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
          />
        );
      case CombinedTransactionTypeEnum.TRANSFER:
        // For transfers, we need to map the transaction data to the expected format
        const transferData: UpdateTransferType = {
          id: fullTransactionData.id,
          amount: fullTransactionData.amount,
          transactionCost: (fullTransactionData as any).transactionCost || 0,
          fromAccountName: (fullTransactionData as any).fromAccountName || "",
          toAccountName: (fullTransactionData as any).toAccountName || "",
          description: fullTransactionData.description,
          date: fullTransactionData.date,
          scheduleType: fullTransactionData.scheduleType,
          repeatInterval: fullTransactionData.repeatInterval,
          file: fullTransactionData.file || undefined, // Ensure file is explicitly included here
          updateScope: fullTransactionData.updateScope,
        };
        
        return (
          <TransferForm
            key={`transfer-form-${dataKey}`}
            id={transaction.id}
            initialData={transferData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
          />
        );
      default:
        return <div className="py-8 text-center">Unsupported transaction type</div>;
    }
  };

  return (
    <>
      <CustomModal
        isOpen={isOpen}
        onClose={onClose}
        title={getDialogTitle()}
        maxWidth="2xl"
        className="p-0"
      >
        <div className="px-6 pb-6 pt-4">
          <p className="text-sm text-muted-foreground mb-4">
            {getDialogDescription()}
          </p>
          {renderForm()}
        </div>
      </CustomModal>

      {/* Update Scope Modal */}
      <ScopeModal
        isOpen={showUpdateScopeModal}
        operationType="update"
        onClose={handleUpdateScopeCancel}
        onConfirm={handleUpdateScopeConfirm}
        scheduleTypeChange={scheduleTypeChange || { from: "", to: "" }}
        selectedScope={updateScope}
        onScopeChange={handleUpdateScopeChange}
        hasScheduleChanges={hasScheduleChanges}
        transactionType={transaction?.type}
        inSeries={fullTransactionData?.scheduleType === ScheduleTypeEnum.REPEAT || fullTransactionData?.scheduleType === ScheduleTypeEnum.INSTALLMENT}
      />
    </>
  );
};

export default EditTransactionDialog; 
