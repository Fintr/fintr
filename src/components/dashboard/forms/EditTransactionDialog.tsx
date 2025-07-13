import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ExpenseForm from "./ExpenseForm";
import IncomeForm from "./IncomeForm";
import TransferForm from "./TransferForm";
import ScopeModal, { UpdateScope, Scope } from "./ScopeModal";
import { IndexTransaction, TransactionTypeEnum, TransferUpdateTransactionType, UpdateTransactionType } from "@/types/transactionTypes";
import { UpdateTransferType, updateTransfer } from "@/services/transactions/transfers/mutation";
import { updateTransaction } from "@/services/transactions/mutation";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import { useAuthApi } from "@/hooks/useAuthApi";
import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import { toast } from "sonner";

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
  
  // Update scope modal state
  const [showUpdateScopeModal, setShowUpdateScopeModal] = useState(false);
  const [updateScope, setUpdateScope] = useState<UpdateScope>(UpdateScopeEnum.THIS_ONLY);
  const [scheduleTypeChange, setScheduleTypeChange] = useState<{from: string; to: string} | null>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false);

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      if (transaction?.id && api && isOpen) {
        setIsLoading(true);
        try {
          let data;
          
          // Use the appropriate endpoint based on transaction type
          if (transaction.type === TransactionTypeEnum.TRANSFER) {
            data = await fetchTransferById(api, transaction.id);
          } else {
            data = await fetchTransactionById(api, transaction.id);
          }
          
          setFullTransactionData(data);
          // Set the date from the transaction data
          if (data.date) {
            setDate(new Date(data.date));
          }
        } catch (error) {
          toast.error("Failed to fetch transaction details.");
          console.error(error);
          onClose();
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (isOpen && transaction) {
      fetchTransactionDetails();
    } else {
      setFullTransactionData(null);
      setDate(new Date());
      setShowUpdateScopeModal(false);
      setScheduleTypeChange(null);
      setPendingFormData(null);
      setHasScheduleChanges(false);
    }
  }, [transaction?.id, isOpen, api, onClose]);

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
    console.log("scheduleFieldsChanged",scheduleFieldsChanged, {
      originalData: {
        scheduleType: originalData.scheduleType,
        repeatInterval: originalData.repeatInterval,
        installmentPeriod: originalData.installmentPeriod,
      },
      newData: {
        scheduleType: newData.scheduleType,
        repeatInterval: newData.repeatInterval,
      }
    });
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

  const handleSuccess = async (data: any) => {
    try {
      let response;
      
      if (transaction?.type === TransactionTypeEnum.TRANSFER) {
        response = await updateTransfer(api, data);
        toast.success("Transfer updated successfully");
      } else {
        response = await updateTransaction(api, data);
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
      case TransactionTypeEnum.EXPENSE:
        return "Edit Expense";
      case TransactionTypeEnum.INCOME:
        return "Edit Income";
      case TransactionTypeEnum.TRANSFER:
        return "Edit Transfer";
      default:
        return "Edit Transaction";
    }
  };

  const getDialogDescription = () => {
    switch (transaction?.type) {
      case TransactionTypeEnum.EXPENSE:
        return "Update the details of your expense transaction.";
      case TransactionTypeEnum.INCOME:
        return "Update the details of your income transaction.";
      case TransactionTypeEnum.TRANSFER:
        return "Update the details of your transfer transaction.";
      default:
        return "Update the details of your transaction.";
    }
  };

  const renderForm = () => {
    if (isLoading) {
      return <div className="py-8 text-center">Loading transaction details...</div>;
    }

    if (!fullTransactionData || !transaction) {
      return <div className="py-8 text-center">No transaction data available</div>;
    }

    switch (transaction.type) {
      case TransactionTypeEnum.EXPENSE:
        return (
          <ExpenseForm
            id={transaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
          />
        );
      case TransactionTypeEnum.INCOME:
        return (
          <IncomeForm
            id={transaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
          />
        );
      case TransactionTypeEnum.TRANSFER:
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
          file: fullTransactionData.file || undefined,
          updateScope: fullTransactionData.updateScope,
        };

        console.log("transferData", transferData);
        
        return (
          <TransferForm
            id={transaction.id}
            initialData={transferData}
            date={date}
            setDate={setDate}
            onSubmitSuccess={handleFormSubmit}
            onCancel={onClose}
            isEditMode={true}
          />
        );
      default:
        return <div className="py-8 text-center">Unsupported transaction type</div>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              {getDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>

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
      />
    </>
  );
};

export default EditTransactionDialog; 
