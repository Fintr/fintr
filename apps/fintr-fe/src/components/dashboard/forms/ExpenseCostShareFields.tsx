"use client";

import React from "react";
import { Plus, Users, X } from "lucide-react";
import {
  allocateCostShare,
  COST_SHARE_MODES,
  costShareEntryBounds,
  type CostShareAllocation,
  type CostShareMode,
  type CostShareParticipantInput,
} from "@fintr/domain";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { ProRequiredNotice } from "@/components/settings/pro-feature-gate";
import { ProTrialBadge } from "@/components/settings/pro-trial-badge";
import { useProAccess } from "@/hooks/async/useProAccess";
import { Button } from "@/components/ui/button";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { clampBoundedDraft } from "@/lib/clamp-bounded-draft";
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

const PERCENT_TOTAL_HUNDREDTHS = 10_000;

const shareFieldId = (
  field: "amount" | "percent",
  index: number,
): string => `cost-share-${field}-${index}`;

const toShareHundredths = (value: number): number => Math.round(value * 100);

const sameShare = (
  left: number | undefined,
  right: number | undefined,
): boolean => {
  if (left == null && right == null) {
    return true;
  }

  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  return toShareHundredths(left) === toShareHundredths(right);
};

const displayedShare = (
  fallback: number | undefined,
  drafts: Record<string, string>,
  fieldId: string,
): number | undefined => {
  if (!Object.prototype.hasOwnProperty.call(drafts, fieldId)) {
    return fallback;
  }

  return parseShareNumber(drafts[fieldId]);
};

const draftShare = (
  drafts: Record<string, string>,
  field: "amount" | "percent",
  index: number,
): number | undefined | "unchanged" => {
  const fieldId = shareFieldId(field, index);
  if (!Object.prototype.hasOwnProperty.call(drafts, fieldId)) {
    return "unchanged";
  }

  const parsed = parseShareNumber(drafts[fieldId]);
  if (parsed == null) {
    return undefined;
  }

  if (parsed < 0.01) {
    return "unchanged";
  }

  return parsed;
};

const participantsWithDrafts = (
  participants: CostShareParticipantInput[],
  drafts: Record<string, string>,
  mode: CostShareMode,
): CostShareParticipantInput[] =>
  participants.map((participant, index) => {
    if (mode === "equal") {
      return participant;
    }

    const field = mode === "percent" ? "percent" : "amount";
    const fieldId = shareFieldId(field, index);
    if (!Object.prototype.hasOwnProperty.call(drafts, fieldId)) {
      return participant;
    }

    return {
      ...participant,
      [field]: parseShareNumber(drafts[fieldId]),
    };
  });

/** Lowers the most recently edited share first so the percentages total 100. */
const capPercentShares = (
  percents: Array<number | undefined>,
  preferredIndex: number | null,
): Array<number | undefined> | null => {
  const hundredths = percents.map((percent) =>
    percent == null || !Number.isFinite(percent) || percent <= 0
      ? 0
      : toShareHundredths(percent),
  );
  const total = hundredths.reduce((sum, part) => sum + part, 0);
  if (total <= PERCENT_TOTAL_HUNDREDTHS) {
    return null;
  }

  const order: number[] = [];
  if (
    preferredIndex != null
    && preferredIndex >= 0
    && preferredIndex < percents.length
  ) {
    order.push(preferredIndex);
  }

  for (let index = percents.length - 1; index >= 0; index -= 1) {
    if (!order.includes(index)) {
      order.push(index);
    }
  }

  let excess = total - PERCENT_TOTAL_HUNDREDTHS;
  const next = [...percents];
  for (const index of order) {
    if (excess <= 0) {
      break;
    }

    const current = hundredths[index];
    if (current <= 0) {
      continue;
    }

    const reduction = Math.min(current, excess);
    const remaining = current - reduction;
    excess -= reduction;
    next[index] = remaining >= 1 ? remaining / 100 : undefined;
  }

  return next;
};

/** Cent rounding matches allocatePercent so the inline amount is the saved share. */
const percentShareAmount = (
  totalAmount: number,
  percent: number | undefined,
): number | null => {
  if (percent == null || !Number.isFinite(percent)) {
    return null;
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return null;
  }

  const totalCents = Math.round(totalAmount * 100);
  const shareCents = Math.round(totalCents * (percent / 100));

  return Number((shareCents / 100).toFixed(2));
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
  const { data: proAccess, isPending, isPaused } = useProAccess();
  const hasPro = proAccess?.pro === true;
  const isCheckingPro = !proAccess && isPending && !isPaused;
  const [shareDrafts, setShareDrafts] = React.useState<Record<string, string>>(
    {},
  );
  const valueRef = React.useRef(value);
  const draftsRef = React.useRef(shareDrafts);
  const onChangeRef = React.useRef(onChange);
  const totalAmountRef = React.useRef(totalAmount);
  const lastEditedPercentIndexRef = React.useRef<number | null>(null);
  valueRef.current = value;
  draftsRef.current = shareDrafts;
  onChangeRef.current = onChange;
  totalAmountRef.current = totalAmount;

  const emit = (nextValue: ExpenseCostShareValue) => {
    valueRef.current = nextValue;
    onChangeRef.current(nextValue);
  };

  React.useEffect(() => {
    if (!value.enabled || value.mode !== "percent") {
      return;
    }

    const currentPercents = value.participants.map((participant, index) =>
      displayedShare(
        participant.percent,
        draftsRef.current,
        shareFieldId("percent", index),
      ),
    );
    const capped = capPercentShares(
      currentPercents,
      lastEditedPercentIndexRef.current,
    );
    if (capped == null) {
      return;
    }

    setShareDrafts((current) => {
      let changed = false;
      const next = { ...current };
      capped.forEach((percent, index) => {
        if (sameShare(percent, currentPercents[index])) {
          return;
        }

        const fieldId = shareFieldId("percent", index);
        next[fieldId] = percent == null ? "" : String(percent);
        changed = true;
      });

      if (!changed) {
        return current;
      }

      return next;
    });

    const storedAlreadyCapped = value.participants.every((participant, index) =>
      sameShare(participant.percent, capped[index]),
    );
    if (storedAlreadyCapped) {
      return;
    }

    emit({
      ...value,
      participants: value.participants.map((participant, index) => ({
        ...participant,
        percent: capped[index],
      })),
    });
  }, [value, shareDrafts]);

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
    const current = valueRef.current;
    const field = current.mode === "amount" ? "amount" : "percent";
    emit({
      ...current,
      participants: current.participants.map((participant, participantIndex) => {
        const drafted = draftShare(
          draftsRef.current,
          field,
          participantIndex,
        );
        const withDraft =
          current.mode === "equal" || drafted === "unchanged"
            ? participant
            : { ...participant, [field]: drafted };

        return participantIndex === index
          ? { ...withDraft, ...patch }
          : withDraft;
      }),
    });
  };

  const commitShare = (
    index: number,
    field: "amount" | "percent",
    raw: string,
  ) => {
    if (field === "percent") {
      lastEditedPercentIndexRef.current = index;
    }

    const current = valueRef.current;
    const bounds = costShareEntryBounds({
      mode: current.mode,
      totalAmount: totalAmountRef.current,
      participants: participantsWithDrafts(
        current.participants,
        draftsRef.current,
        current.mode,
      ),
      index,
    });
    const draft = clampBoundedDraft(raw, bounds);
    const fieldId = shareFieldId(field, index);
    const nextDrafts = {
      ...draftsRef.current,
      [fieldId]: draft,
    };
    draftsRef.current = nextDrafts;
    setShareDrafts(nextDrafts);

    const parsed = parseShareNumber(draft);
    const accepted =
      parsed != null && parsed >= bounds.min && parsed <= bounds.max
        ? parsed
        : undefined;
    updateParticipant(index, { [field]: accepted });
  };

  const openSplit = () => {
    if (!hasPro) {
      return;
    }

    onChange({
      enabled: true,
      mode: value.mode,
      participants:
        value.participants.length > 0
          ? value.participants
          : [{ entityName: "" }],
    });
  };

  if (!hasPro || !value.enabled) {
    return (
      <div className="space-y-2">
        <Label>Split</Label>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-sm"
          disabled={disabled || isCheckingPro}
          onClick={openSplit}
        >
          <Users className="mr-2 h-4 w-4" aria-hidden />
          Split with people
          <ProTrialBadge className="ml-2" />
        </Button>
        {!hasPro && !isCheckingPro ? (
          <ProRequiredNotice featureName="Split with people" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          Split with people
          <ProTrialBadge />
        </Label>
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
          const shareAmount =
            value.mode === "percent"
              ? percentShareAmount(totalAmount, participant.percent)
              : null;
          const entryBounds = costShareEntryBounds({
            mode: value.mode,
            totalAmount,
            participants: participantsWithDrafts(
              value.participants,
              shareDrafts,
              value.mode,
            ),
            index,
          });
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
                    minValue={entryBounds.min}
                    maxValue={entryBounds.max}
                    followValue
                    disabled={disabled}
                    placeholder="0.00"
                    onChange={(nextValue) => {
                      commitShare(index, "amount", nextValue);
                    }}
                  />
                </div>
              ) : null}

              {value.mode === "percent" ? (
                <div className="space-y-2">
                  <Label htmlFor={percentFieldId}>Percentage</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <CalculatorInput
                        id={percentFieldId}
                        value={shareFieldValue(percentFieldId, participant.percent)}
                        minValue={entryBounds.min}
                        maxValue={entryBounds.max}
                        followValue
                        disabled={disabled}
                        placeholder="0"
                        onChange={(nextValue) => {
                          commitShare(index, "percent", nextValue);
                        }}
                      />
                    </div>
                    {shareAmount != null ? (
                      <p
                        className="ml-auto flex h-10 shrink-0 items-center text-base font-semibold tabular-nums"
                        aria-label="Share amount"
                      >
                        {formatCurrency(shareAmount, currency)}
                      </p>
                    ) : null}
                  </div>
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
