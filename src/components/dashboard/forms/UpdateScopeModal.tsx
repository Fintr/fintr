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
import { UpdateScopeEnum } from "@/constants/transactionConstants";

export type UpdateScope = UpdateScopeEnum;

interface UpdateScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: UpdateScope) => void;
  scheduleTypeChange: {
    from: string;
    to: string;
  };
  selectedScope: UpdateScope;
  onScopeChange: (scope: UpdateScope) => void;
  hasScheduleChanges?: boolean; // New prop to indicate if schedule-related fields changed
}

const UpdateScopeModal: React.FC<UpdateScopeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scheduleTypeChange,
  selectedScope,
  onScopeChange,
  hasScheduleChanges = false,
}) => {
  // Determine if only "this_and_future" is allowed (for repeat to one_time)
  const isOnlyThisAndFutureAllowed = 
    scheduleTypeChange.from === "repeat" && scheduleTypeChange.to === "one_time";

  // Determine if all_in_series option should be available
  const isAllInSeriesAvailable = !hasScheduleChanges;

  const handleConfirm = () => {
    onConfirm(selectedScope);
  };

  const getModalContent = () => {
    if (isOnlyThisAndFutureAllowed) {
      return {
        title: "Update Recurring Transaction",
        description: "You are changing this recurring transaction to a one-time transaction. This will delete all future recurring transactions in this series.",
        warning: "⚠️ All future transactions in this recurring series will be permanently deleted.",
      };
    }

    if (hasScheduleChanges) {
      return {
        title: "Update Transaction Scope",
        description: "You are updating schedule-related fields (schedule type, repeat interval, or installment period). Please choose which transactions to update:",
        warning: "⚠️ Changes to schedule settings cannot be applied to all transactions in the series.",
      };
    }

    return {
      title: "Update Transaction Scope",
      description: "You are updating a transaction that is part of a series. Please choose which transactions to update:",
      warning: null,
    };
  };

  const content = getModalContent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(isOnlyThisAndFutureAllowed || hasScheduleChanges) && (
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
            onValueChange={(value) => onScopeChange(value as UpdateScope)}
            className="space-y-3"
          >
            {!isOnlyThisAndFutureAllowed && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={UpdateScopeEnum.THIS_ONLY} id="this_only" />
                <Label htmlFor="this_only" className="cursor-pointer">
                  <div>
                    <div className="font-medium">This transaction only</div>
                    <div className="text-sm text-gray-500">
                      Update only this specific transaction
                    </div>
                  </div>
                </Label>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <RadioGroupItem value={UpdateScopeEnum.THIS_AND_FUTURE} id="this_and_future" />
              <Label htmlFor="this_and_future" className="cursor-pointer">
                <div>
                  <div className="font-medium">
                    {isOnlyThisAndFutureAllowed 
                      ? "Update and delete future transactions" 
                      : "This and all future transactions"
                    }
                  </div>
                  <div className="text-sm text-gray-500">
                    {isOnlyThisAndFutureAllowed
                      ? "Update this transaction and delete all future recurring transactions"
                      : "Update this transaction and all future transactions in the series"
                    }
                  </div>
                </div>
              </Label>
            </div>

            {isAllInSeriesAvailable && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={UpdateScopeEnum.ALL_IN_SERIES} id="all_in_series" />
                <Label htmlFor="all_in_series" className="cursor-pointer">
                  <div>
                    <div className="font-medium">All transactions in series</div>
                    <div className="text-sm text-gray-500">
                      Update all transactions in this recurring series (past, present, and future)
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
          <Button onClick={handleConfirm}>
            {isOnlyThisAndFutureAllowed ? "Update & Delete Future" : "Update Transactions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateScopeModal; 
