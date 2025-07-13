import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Label } from "../../ui/label";
import { AlertTriangle } from "lucide-react";
import { UpdateScopeEnum, DeleteScopeEnum } from "@/constants/transactionConstants";
import { TransactionTypeEnum } from "@/types/transactionTypes";

export type UpdateScope = UpdateScopeEnum;
export type DeleteScope = DeleteScopeEnum;
export type Scope = UpdateScope | DeleteScope;

type OperationType = "update" | "delete";

interface ScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: Scope) => void;
  scheduleTypeChange?: {
    from: string;
    to: string;
  };
  selectedScope: Scope;
  onScopeChange: (scope: Scope) => void;
  hasScheduleChanges?: boolean;
  operationType: OperationType;
  inSeries?: boolean; // New prop to determine if transaction is part of a series
  transactionType?: TransactionTypeEnum; // New prop to determine transaction type
}

const ScopeModal: React.FC<ScopeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scheduleTypeChange,
  selectedScope,
  onScopeChange,
  hasScheduleChanges = false,
  operationType,
  inSeries = true, // Default to true for backward compatibility
  transactionType,
}) => {
  // Determine if only "this_and_future" is allowed (for repeat to one_time)
  const isOnlyThisAndFutureAllowed = 
    scheduleTypeChange?.from === "repeat" && scheduleTypeChange?.to === "one_time";

  // Determine if all_in_series option should be available
  const isAllInSeriesAvailable = !hasScheduleChanges && inSeries;

  // For non-series transactions, only show "this_only" option
  const showOnlyThisOnly = !inSeries;

  // Determine entity type strings for use throughout the component
  const entityType = transactionType === TransactionTypeEnum.TRANSFER ? "Transfer" : "Transaction";
  const entityTypeLower = transactionType === TransactionTypeEnum.TRANSFER ? "transfer" : "transaction";

  const handleConfirm = () => {
    onConfirm(selectedScope);
  };

  const getModalContent = () => {
    const isDelete = operationType === "delete";
    const actionWord = isDelete ? "Delete" : "Update";
    const actionWordLower = isDelete ? "delete" : "update";
    
    if (showOnlyThisOnly) {
      return {
        title: `${actionWord} ${entityType}`,
        description: `You are ${actionWordLower}ing a single ${entityTypeLower}. This action will ${actionWordLower} only this specific ${entityTypeLower}.`,
        warning: isDelete ? `⚠️ This action cannot be undone. The ${entityTypeLower} will be permanently removed.` : null,
      };
    }
    
    if (isOnlyThisAndFutureAllowed && !isDelete) {
      return {
        title: "Update Recurring Transaction",
        description: "You are changing this recurring transaction to a one-time transaction. This will delete all future recurring transactions in this series.",
        warning: "⚠️ All future transactions in this recurring series will be permanently deleted.",
      };
    }

    if (hasScheduleChanges && !isDelete) {
      return {
        title: `Update ${entityType} Scope`,
        description: `You are updating schedule-related fields (schedule type, repeat interval, or installment period). Please choose which ${entityTypeLower}s to update:`,
        warning: `⚠️ Changes to schedule settings cannot be applied to all ${entityTypeLower}s in the series.`,
      };
    }

    if (isDelete) {
      return {
        title: `Delete ${entityType} Scope`,
        description: `You are deleting a ${entityTypeLower} that is part of a series. Please choose which ${entityTypeLower}s to delete:`,
        warning: `⚠️ This action cannot be undone. Deleted ${entityTypeLower}s will be permanently removed.`,
      };
    }

    return {
      title: `${actionWord} ${entityType} Scope`,
      description: `You are ${actionWordLower}ing a ${entityTypeLower} that is part of a series. Please choose which ${entityTypeLower}s to ${actionWordLower}:`,
      warning: null,
    };
  };

  const content = getModalContent();
  const isDelete = operationType === "delete";
  const actionWord = isDelete ? "Delete" : "Update";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(isOnlyThisAndFutureAllowed || hasScheduleChanges || isDelete) && (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {content.warning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">{content.warning}</p>
            </div>
          )}

          <RadioGroup
            value={selectedScope}
            onValueChange={(value) => onScopeChange(value as Scope)}
            className="space-y-3"
          >
            {/* Always show "this_only" option */}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={UpdateScopeEnum.THIS_ONLY} id="this_only" />
              <Label htmlFor="this_only" className="cursor-pointer">
                <div>
                  <div className="font-medium">This {entityTypeLower} only</div>
                  <div className="text-sm text-gray-500">
                    {actionWord} only this specific {entityTypeLower}
                  </div>
                </div>
              </Label>
            </div>

            {/* Show series options only if transaction is in a series */}
            {!showOnlyThisOnly && !isOnlyThisAndFutureAllowed && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={UpdateScopeEnum.THIS_AND_FUTURE} id="this_and_future" />
                <Label htmlFor="this_and_future" className="cursor-pointer">
                  <div>
                    <div className="font-medium">This and all future {entityTypeLower}s</div>
                    <div className="text-sm text-gray-500">
                      {actionWord} this {entityTypeLower} and all future {entityTypeLower}s in the series
                    </div>
                  </div>
                </Label>
              </div>
            )}

            {/* Special case for repeat to one_time */}
            {isOnlyThisAndFutureAllowed && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={UpdateScopeEnum.THIS_AND_FUTURE} id="this_and_future" />
                <Label htmlFor="this_and_future" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Update and delete future {entityTypeLower}s</div>
                    <div className="text-sm text-gray-500">
                      Update this {entityTypeLower} and delete all future recurring {entityTypeLower}s
                    </div>
                  </div>
                </Label>
              </div>
            )}

            {/* Show all_in_series option only if available */}
            {isAllInSeriesAvailable && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={UpdateScopeEnum.ALL_IN_SERIES} id="all_in_series" />
                <Label htmlFor="all_in_series" className="cursor-pointer">
                  <div>
                    <div className="font-medium">All {entityTypeLower}s in series</div>
                    <div className="text-sm text-gray-500">
                      {actionWord} all {entityTypeLower}s in this recurring series (past, present, and future)
                    </div>
                  </div>
                </Label>
              </div>
            )}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            variant={isDelete ? "destructive" : "default"}
          >
            {isOnlyThisAndFutureAllowed && !isDelete 
              ? "Update & Delete Future" 
              : showOnlyThisOnly 
                ? `${actionWord} ${entityType}`
                : `${actionWord} ${entityType}s`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScopeModal; 
