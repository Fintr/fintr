"use client";

import React from "react";
import { Plus, Users, X } from "lucide-react";
import {
  allocateCostShare,
  COST_SHARE_MODES,
  type CostShareAllocation,
  type CostShareMode,
  type CostShareParticipantInput,
} from "@fintr/domain";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { Button } from "@/components/ui/button";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";

import LoanEntityField from "./LoanEntityField";

export type ExpenseCostShareValue = {
  enabled: boolean;
  mode: CostShareMode;
  participants: CostShareParticipantInput[];
};

export const shouldShowExpenseCostShare = ({
  isEditMode,
  scheduleType,
}: {
  isEditMode: boolean;
  scheduleType: ScheduleTypeEnum;
}): boolean =>
  !isEditMode && scheduleType === ScheduleTypeEnum.ONE_TIME;

const MODE_LABELS: Record<CostShareMode, string> = {
  equal: "Equal",
  amount: "Amount",
  percent: "Percent",
};

const namedParticipants = (
  participants: CostShareParticipantInput[],
): CostShareParticipantInput[] =>
  participants.filter((participant) => participant.entityName.trim().length > 0);

const parseShareNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return undefined;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const displayShareNumber = (value: number | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  return String(value);
};

export const previewExpenseCostShare = ({
  totalAmount,
  mode,
  participants,
}: {
  totalAmount: number;
  mode: CostShareMode;
  participants: CostShareParticipantInput[];
}): CostShareAllocation | null => {
  try {
    return allocateCostShare({
      totalAmount,
      mode,
      participants: namedParticipants(participants),
    });
  } catch {
    return null;
  }
};

type ExpenseCostShareFieldsProps = {
  value: ExpenseCostShareValue;
  onChange: (value: ExpenseCostShareValue) => void;
  totalAmount: number;
  currency?: string;
  disabled?: boolean;
};

const ExpenseCostShareFields: React.FC<ExpenseCostShareFieldsProps> = ({
  value,
  onChange,
  totalAmount,
  currency = "PHP",
  disabled = false,
}) => {
  const [shareDrafts, setShareDrafts] = React.useState<Record<string, string>>(
    {},
  );

  const preview = value.enabled
    ? previewExpenseCostShare({
        totalAmount,
        mode: value.mode,
        participants: value.participants,
      })
    : null;

  const shareFieldValue = (
    fieldId: string,
    numeric: number | undefined,
  ): string =>
    Object.prototype.hasOwnProperty.call(shareDrafts, fieldId)
      ? shareDrafts[fieldId]
      : displayShareNumber(numeric);

  const updateParticipant = (
    index: number,
    patch: Partial<CostShareParticipantInput>,
  ) => {
    onChange({
      ...value,
      participants: value.participants.map((participant, participantIndex) =>
        participantIndex === index
          ? { ...participant, ...patch }
          : participant,
      ),
    });
  };

  if (!value.enabled) {
    return (
      <div className="space-y-2">
        <Label>Split</Label>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-sm"
          disabled={disabled}
          onClick={() =>
            onChange({
              enabled: true,
              mode: value.mode,
              participants:
                value.participants.length > 0
                  ? value.participants
                  : [{ entityName: "" }],
            })
          }
        >
          <Users className="mr-2 h-4 w-4" aria-hidden />
          Split with people
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Split with people</Label>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() =>
            onChange({
              enabled: false,
              mode: "equal",
              participants: [],
            })
          }
        >
          Remove split
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
        {COST_SHARE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            className={cn(
              "rounded-sm px-2 py-1.5 text-sm",
              value.mode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
            onClick={() => {
              setShareDrafts({});
              onChange({ ...value, mode });
            }}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {value.participants.map((participant, index) => {
          const amountFieldId = `cost-share-amount-${index}`;
          const percentFieldId = `cost-share-percent-${index}`;
          const excludedNames = value.participants
            .filter((_, participantIndex) => participantIndex !== index)
            .map((other) => other.entityName.trim())
            .filter(Boolean);

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <LoanEntityField
                    loanType="lent"
                    value={participant.entityName}
                    excludeNames={excludedNames}
                    onChange={(entityName) => updateParticipant(index, { entityName })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-7 h-10 w-10 shrink-0 px-0"
                  disabled={disabled}
                  aria-label={`Remove ${participant.entityName || "person"}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      participants: value.participants.filter(
                        (_, participantIndex) => participantIndex !== index,
                      ),
                    })
                  }
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              {value.mode === "amount" ? (
                <div className="space-y-2">
                  <Label htmlFor={amountFieldId}>Amount</Label>
                <CalculatorInput
                  id={amountFieldId}
                  value={shareFieldValue(amountFieldId, participant.amount)}
                  disabled={disabled}
                  placeholder="0.00"
                  onChange={(nextValue) => {
                    setShareDrafts((current) => ({
                      ...current,
                      [amountFieldId]: nextValue,
                    }));
                    updateParticipant(index, {
                      amount: parseShareNumber(nextValue),
                    });
                  }}
                />
                </div>
              ) : null}

              {value.mode === "percent" ? (
                <div className="space-y-2">
                  <Label htmlFor={percentFieldId}>Percentage</Label>
                <CalculatorInput
                  id={percentFieldId}
                  value={shareFieldValue(percentFieldId, participant.percent)}
                  disabled={disabled}
                  placeholder="0"
                  onChange={(nextValue) => {
                    setShareDrafts((current) => ({
                      ...current,
                      [percentFieldId]: nextValue,
                    }));
                    updateParticipant(index, {
                      percent: parseShareNumber(nextValue),
                    });
                  }}
                />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full text-sm"
        disabled={disabled}
        onClick={() =>
          onChange({
            ...value,
            participants: [...value.participants, { entityName: "" }],
          })
        }
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        {value.participants.some((participant) => participant.entityName.trim())
          ? "Add another person"
          : "Add person"}
      </Button>

      {preview ? (
        <p className="text-sm text-muted-foreground">
          Your expense {formatCurrency(preview.yourShare, currency)}
          {preview.participants.map((person) => (
            <span key={person.entityName}>
              {" · "}
              {person.entityName} owes you {formatCurrency(person.amount, currency)}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
};

export default ExpenseCostShareFields;
