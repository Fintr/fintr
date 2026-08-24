import { describe, expect, it, afterEach } from "vitest";

import "fake-indexeddb/auto";

import { resetLocalDbForTests } from "@/lib/local-db";
import { replaceSpaceAccounts } from "@/lib/local-db/accounts";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  attachUpdateTransactionRelationIds,
  coalesceIndexRelationIds,
  stampIndexTransactionRelationIds,
  syncIndexTransactionRelationNames,
  type RelationStampContext,
} from "./relation-ids-local";

const buildContext = (): RelationStampContext => ({
  accounts: [{ id: "acc-bdo", name: "BDO - Ella2" }],
  accountResolvers: [
    {
      id: "acc-bdo",
      names: new Set(["bdo - ella2", "bdo - ella"]),
    },
  ],
  entities: [],
  expenseOptions: [],
  incomeOptions: [],
});

describe("coalesceIndexRelationIds", () => {
  it("keeps list-row ids when the mapped detail omits them", () => {
    const merged = coalesceIndexRelationIds({
      mapped: {
        entityId: null,
        accountId: null,
        fromAccountId: null,
        toAccountId: null,
      },
      local: {
        entityId: "ent-jollibee",
        accountId: "acc-cash",
        fromAccountId: "acc-cash",
        toAccountId: null,
        type: CombinedTransactionTypeEnum.EXPENSE,
      },
    });

    expect(merged).toEqual({
      entityId: "ent-jollibee",
      accountId: "acc-cash",
      fromAccountId: "acc-cash",
      toAccountId: null,
    });
  });

  it("prefers local account ids over stale mapped detail ids", () => {
    const merged = coalesceIndexRelationIds({
      mapped: {
        entityId: "ent-old",
        accountId: "acc-cash",
        fromAccountId: "acc-cash",
        toAccountId: null,
      },
      local: {
        entityId: "ent-jollibee",
        accountId: "acc-bdo",
        fromAccountId: "acc-bdo",
        toAccountId: null,
        type: CombinedTransactionTypeEnum.EXPENSE,
      },
    });

    expect(merged).toEqual({
      entityId: "ent-jollibee",
      accountId: "acc-bdo",
      fromAccountId: "acc-bdo",
      toAccountId: null,
    });
  });
});

describe("stampIndexTransactionRelationIds", () => {
  it("stamps account ids from legacy names after a rename", () => {
    const stamped = syncIndexTransactionRelationNames(
      stampIndexTransactionRelationIds(
      {
        id: "txn-1",
        date: "2026-08-17",
        description: "Payment",
        amount: 100,
        categoryName: "Food",
        fromAccountName: "BDO - Ella",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
      buildContext(),
      ),
      buildContext(),
    );

    expect(stamped.fromAccountId).toBe("acc-bdo");
    expect(stamped.accountId).toBe("acc-bdo");
    expect(stamped.fromAccountName).toBe("BDO - Ella2");
  });
});

describe("attachUpdateTransactionRelationIds", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("resolves account id when the account name changes during update", async () => {
    await replaceSpaceAccounts("space-a", [
      { id: "acc-cash", name: "Cash" },
      { id: "acc-bdo", name: "BDO2 CC - Ella" },
    ]);

    const updated = await attachUpdateTransactionRelationIds(
      "space-a",
      {
        id: "txn-1",
        date: "2026-08-31",
        description: "Recurring2",
        amount: 82.07,
        categoryName: "Food & Groceries",
        accountName: "BDO2 CC - Ella",
        transactionType: "expense",
        type: CombinedTransactionTypeEnum.EXPENSE,
        scheduleType: "repeat" as const,
        repeatInterval: "every_month",
        installmentPeriod: 0,
      },
      {
        fromAccountName: "Cash",
        fromAccountId: "acc-cash",
        accountId: "acc-cash",
        type: CombinedTransactionTypeEnum.EXPENSE,
      },
    );

    expect(updated.accountId).toBe("acc-bdo");
  });
});
