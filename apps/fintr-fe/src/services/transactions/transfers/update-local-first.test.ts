import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  getLocalDb,
  OUTBOX_COMMAND_TRANSFER_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  updateTransfer: vi.fn(),
}));

import { updateTransfer } from "./mutation";
import { updateTransferLocalFirst } from "./update-local-first";

const seedTransfer = async () => {
  await upsertLocalIndexTransaction("space-a", {
    id: "xfer-1",
    date: "2026-08-11",
    description: "Move cash",
    amount: 500,
    amountCurrency: "PHP",
    categoryName: "",
    fromAccountName: "Cash",
    toAccountName: "Bank",
    type: CombinedTransactionTypeEnum.TRANSFER,
    inSeries: false,
    hasImage: false,
  });
};

describe("updateTransferLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("patches IndexedDB when the server succeeds", async () => {
    await seedTransfer();
    vi.mocked(updateTransfer).mockResolvedValue({ success: true });

    const queryClient = new QueryClient();
    const result = await updateTransferLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        amountCurrency: "PHP",
        data: {
          id: "xfer-1",
          amount: 750,
          transactionCost: 0,
          fromAccountName: "Cash",
          toAccountName: "Bank",
          description: "Moved more",
          date: "2026-08-11",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      { queryClient, waitForSync: true },
    );

    expect(result.pendingSync).toBe(false);
    const stored = await loadLocalIndexTransactionById("space-a", "xfer-1");
    expect(stored?.amount).toBe(750);
    expect(stored?.description).toBe("Moved more");
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("keeps local amount and a pending outbox when the network fails", async () => {
    await seedTransfer();
    vi.mocked(updateTransfer).mockRejectedValue(
      new Error("Failed to update transfer"),
    );

    const queryClient = new QueryClient();
    const result = await updateTransferLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        amountCurrency: "PHP",
        data: {
          id: "xfer-1",
          amount: 750,
          transactionCost: 0,
          fromAccountName: "Cash",
          toAccountName: "Bank",
          description: "Moved more",
          date: "2026-08-11",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      { queryClient, waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    const stored = await loadLocalIndexTransactionById("space-a", "xfer-1");
    expect(stored?.amount).toBe(750);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_TRANSFER_UPDATE);
    expect(outbox[0]?.status).toBe("pending");
  });

  it("rolls back local rows when the server rejects the update", async () => {
    await seedTransfer();
    vi.mocked(updateTransfer).mockRejectedValue({
      success: false,
      details: { amount: ["is invalid"] },
    });

    const queryClient = new QueryClient();
    await expect(
      updateTransferLocalFirst(
        {} as never,
        {
          spaceId: "space-a",
          amountCurrency: "PHP",
          data: {
            id: "xfer-1",
            amount: 750,
            transactionCost: 0,
            fromAccountName: "Cash",
            toAccountName: "Bank",
            description: "Moved more",
            date: "2026-08-11",
            scheduleType: ScheduleTypeEnum.ONE_TIME,
          },
        },
        { queryClient, waitForSync: true },
      ),
    ).rejects.toMatchObject({ success: false });

    const stored = await loadLocalIndexTransactionById("space-a", "xfer-1");
    expect(stored?.amount).toBe(500);
    expect(stored?.description).toBe("Move cash");
    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});
