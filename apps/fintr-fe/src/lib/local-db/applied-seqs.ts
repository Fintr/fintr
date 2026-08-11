import { getLocalDb } from "@/lib/local-db/db";

const MAX_APPLIED_SEQS = 500;

export type AppliedSeqsMeta = {
  seqs: number[];
};

const appliedSeqsKey = (spaceId: string): string => `appliedSeqs:${spaceId}`;

export const getAppliedSeqsMeta = async (
  spaceId: string,
): Promise<AppliedSeqsMeta> => {
  if (!spaceId) {
    return { seqs: [] };
  }

  const row = await getLocalDb().meta.get(appliedSeqsKey(spaceId));
  if (!row?.value || typeof row.value !== "object") {
    return { seqs: [] };
  }

  const value = row.value as Partial<AppliedSeqsMeta>;
  if (!Array.isArray(value.seqs)) {
    return { seqs: [] };
  }

  return {
    seqs: value.seqs.filter((seq): seq is number => typeof seq === "number"),
  };
};

export const isSeqApplied = async (
  spaceId: string,
  seq: number,
): Promise<boolean> => {
  if (seq <= 0) {
    return false;
  }

  const meta = await getAppliedSeqsMeta(spaceId);
  return meta.seqs.includes(seq);
};

export const markSeqApplied = async (
  spaceId: string,
  seq: number,
): Promise<void> => {
  if (!spaceId || seq <= 0) {
    return;
  }

  const meta = await getAppliedSeqsMeta(spaceId);
  const next = [...meta.seqs.filter((value) => value !== seq), seq];

  while (next.length > MAX_APPLIED_SEQS) {
    next.shift();
  }

  await getLocalDb().meta.put({
    key: appliedSeqsKey(spaceId),
    value: { seqs: next },
  });
};

export const resetAppliedSeqsForTests = async (spaceId: string): Promise<void> => {
  await getLocalDb().meta.delete(appliedSeqsKey(spaceId));
};
