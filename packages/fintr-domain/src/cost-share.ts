import { DomainValidationError, type FieldErrorMap } from "./errors";

export const COST_SHARE_MODES = ["equal", "amount", "percent"] as const;
export type CostShareMode = (typeof COST_SHARE_MODES)[number];

export type CostShareParticipantInput = {
  entityName: string;
  amount?: number;
  percent?: number;
};

export type AllocateCostShareInput = {
  totalAmount: number;
  mode: CostShareMode;
  participants: CostShareParticipantInput[];
};

export type CostShareParticipantAllocation = {
  entityName: string;
  amount: number;
};

export type CostShareAllocation = {
  yourShare: number;
  participants: CostShareParticipantAllocation[];
};

const toCents = (amount: number): number => Math.round(amount * 100);

const fromCents = (cents: number): number => Number((cents / 100).toFixed(2));

const normalizeName = (name: string): string => name.trim().toLowerCase();

const firstDetailMessage = (details: FieldErrorMap): string =>
  Object.values(details).flat()[0] ?? "Validation failed";

const validationFailure = (details: FieldErrorMap): never => {
  throw new DomainValidationError(details, firstDetailMessage(details));
};

const collectInputErrors = (input: AllocateCostShareInput): FieldErrorMap => {
  const details: FieldErrorMap = {};

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    details.totalAmount = ["must be greater than 0"];
  }

  if (!COST_SHARE_MODES.includes(input.mode)) {
    details.mode = [`must be one of: ${COST_SHARE_MODES.join(", ")}`];
  }

  if (!Array.isArray(input.participants) || input.participants.length === 0) {
    details.participants = ["Add people to split with"];
    return details;
  }

  const seen = new Set<string>();
  input.participants.forEach((participant, index) => {
    const name = participant.entityName?.trim() ?? "";
    if (name.length === 0) {
      details[`participants.${index}.entityName`] = ["is required"];
      return;
    }

    const key = normalizeName(name);
    if (seen.has(key)) {
      details[`participants.${index}.entityName`] = ["Duplicate people are not allowed"];
      details.participants = ["Duplicate people are not allowed"];
      return;
    }
    seen.add(key);

    if (input.mode === "amount") {
      if (!Number.isFinite(participant.amount) || (participant.amount ?? 0) <= 0) {
        details[`participants.${index}.amount`] = ["must be greater than 0"];
      }
    }

    if (input.mode === "percent") {
      if (!Number.isFinite(participant.percent) || (participant.percent ?? 0) <= 0) {
        details[`participants.${index}.percent`] = ["must be greater than 0"];
      }
    }
  });

  return details;
};

const allocateEqual = (
  totalCents: number,
  participants: CostShareParticipantInput[],
): CostShareAllocation => {
  const shareCount = participants.length + 1;
  const othersShareCents = Math.floor(totalCents / shareCount);
  const allocatedOthers = participants.map((participant) => ({
    entityName: participant.entityName.trim(),
    amount: fromCents(othersShareCents),
  }));
  const yourShareCents = totalCents - othersShareCents * participants.length;

  return {
    yourShare: fromCents(yourShareCents),
    participants: allocatedOthers,
  };
};

const allocateAmount = (
  totalCents: number,
  participants: CostShareParticipantInput[],
): CostShareAllocation => {
  const allocatedOthers = participants.map((participant) => ({
    entityName: participant.entityName.trim(),
    amount: fromCents(toCents(participant.amount ?? 0)),
  }));
  const othersCents = allocatedOthers.reduce(
    (sum, person) => sum + toCents(person.amount),
    0,
  );

  return {
    yourShare: fromCents(totalCents - othersCents),
    participants: allocatedOthers,
  };
};

const allocatePercent = (
  totalCents: number,
  participants: CostShareParticipantInput[],
): CostShareAllocation => {
  const allocatedOthers = participants.map((participant) => ({
    entityName: participant.entityName.trim(),
    amount: fromCents(Math.round(totalCents * ((participant.percent ?? 0) / 100))),
  }));
  const othersCents = allocatedOthers.reduce(
    (sum, person) => sum + toCents(person.amount),
    0,
  );
  const percentTotal = participants.reduce(
    (sum, participant) => sum + (participant.percent ?? 0),
    0,
  );

  if (percentTotal >= 100) {
    validationFailure({
      participants: ["Percents must leave a share for you"],
    });
  }

  return {
    yourShare: fromCents(totalCents - othersCents),
    participants: allocatedOthers,
  };
};

export const allocateCostShare = (
  input: AllocateCostShareInput,
): CostShareAllocation => {
  const inputErrors = collectInputErrors(input);
  if (Object.keys(inputErrors).length > 0) {
    validationFailure(inputErrors);
  }

  const totalCents = toCents(input.totalAmount);
  const allocation =
    input.mode === "equal"
      ? allocateEqual(totalCents, input.participants)
      : input.mode === "amount"
        ? allocateAmount(totalCents, input.participants)
        : allocatePercent(totalCents, input.participants);

  if (allocation.yourShare <= 0) {
    validationFailure({
      participants: ["Your share must be greater than 0"],
    });
  }

  if (allocation.participants.some((person) => person.amount <= 0)) {
    validationFailure({
      participants: ["Each person's share must be greater than 0"],
    });
  }

  return allocation;
};

export const assertAllocateCostShare = (input: AllocateCostShareInput): void => {
  try {
    allocateCostShare(input);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw {
        success: false as const,
        message: "Validation failed",
        details: error.details,
      };
    }
    throw error;
  }
};
