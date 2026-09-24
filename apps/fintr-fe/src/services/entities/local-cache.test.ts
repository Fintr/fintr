import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import { putSpaceTransactions } from "@/lib/local-db/transactions";
import { cacheLoansAllPages } from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  filterCachedEntities,
  loadCachedEntitiesResponse,
  loadCachedEntityDetail,
  normalizeEntityRecords,
  cacheEntitiesResponse,
} from "./local-cache";

describe("entities local cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  beforeEach(async () => {
    await resetLocalDbForTests();
  });

  it("keeps a pending local merchant when a stale server list is cached", async () => {
    await cacheEntitiesResponse("SPACE_1", [
      {
        id: "local:merchant-1",
        fullName: "Merchant1",
        entityType: "transaction",
        photoUrl: "blob:merchant-1",
      },
      {
        id: "entity-store",
        fullName: "Store",
        entityType: "transaction",
      },
    ]);

    await cacheEntitiesResponse("SPACE_1", [
      {
        id: "entity-store",
        full_name: "Store",
        entity_type: "transaction",
      },
    ]);

    const cached = await loadCachedEntitiesResponse("SPACE_1");
    expect(cached?.map((entity) => entity.fullName)).toEqual([
      "Store",
      "Merchant1",
    ]);
  });

  it("caches and filters entities by type and search", async () => {
    const rows = normalizeEntityRecords([
      {
        id: "1",
        full_name: "Jollibee",
        entity_type: "transaction",
      },
      {
        id: "2",
        full_name: "BPI",
        entity_type: "loan",
      },
    ]);

    await cacheEntitiesResponse("SPACE_1", rows);

    const cached = await loadCachedEntitiesResponse("SPACE_1");
    expect(cached).toHaveLength(2);
    expect(filterCachedEntities(cached ?? [], "transaction", "joll")).toEqual([
      expect.objectContaining({ fullName: "Jollibee" }),
    ]);
  });

  it("assembles entity detail from the cached merchant and local rows", async () => {
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "Jollibee",
          entity_type: "transaction",
        },
      ]),
    );

    await putSpaceTransactions("SPACE_1", [
      {
        id: "tx-1",
        date: "2026-08-12",
        description: "Chickenjoy",
        amount: 199,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        entityName: "Jollibee",
      },
      {
        id: "tx-other",
        date: "2026-08-11",
        description: "Other",
        amount: 50,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        entityName: "Dairy Queen",
      },
    ]);

    const loan: Loan = {
      id: "loan-1",
      date: "2026-06-18",
      description: "Lunch IOU",
      loanType: "lent",
      loanTermMonths: 1,
      maturityDate: "2026-07-18",
      status: "active",
      paidOffDate: null,
      interestRate: 0,
      entityName: "Jollibee",
      accountName: "Cash",
      principalAmount: 500,
      principalAmountCurrency: "PHP",
      outstandingBalance: 500,
      outstandingBalanceCurrency: "PHP",
      value: 500,
      income: 0,
      expense: 500,
      totalValue: 500,
      files: [],
    };

    await cacheLoansAllPages("SPACE_1", [
      {
        loans: [loan],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const detail = await loadCachedEntityDetail("SPACE_1", "merchant-1");

    expect(detail?.entity).toEqual(
      expect.objectContaining({
        id: "merchant-1",
        fullName: "Jollibee",
      }),
    );
    expect(detail?.transactions).toEqual([
      expect.objectContaining({
        id: "tx-1",
        entityName: "Jollibee",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
      }),
    ]);
    expect(detail?.loans).toEqual([
      expect.objectContaining({
        id: "loan-1",
        entityName: "Jollibee",
      }),
    ]);
  });

  it("returns undefined when the entity is not in the local cache", async () => {
    const detail = await loadCachedEntityDetail("SPACE_1", "missing");
    expect(detail).toBeUndefined();
  });

  it("keeps merchant identifiers on the cached entity detail", async () => {
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "1855",
          entity_type: "transaction",
          identifiers: [
            {
              id: "alias-1",
              label: "CORPORATION A",
              scanned_name: "corporation a",
            },
          ],
        },
      ]),
    );

    const detail = await loadCachedEntityDetail("SPACE_1", "merchant-1");

    expect(detail?.identifiers).toEqual([
      {
        id: "alias-1",
        label: "CORPORATION A",
        scannedName: "corporation a",
      },
    ]);
  });

  it("keeps identifiers when a later entity cache write omits them", async () => {
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "1855",
          entity_type: "transaction",
          identifiers: [
            {
              id: "alias-1",
              label: "CORPORATION A",
              scannedName: "corporation a",
            },
          ],
        },
      ]),
    );

    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "1855 Photo",
          entity_type: "transaction",
        },
      ]),
    );

    const cached = await loadCachedEntitiesResponse("SPACE_1");
    expect(cached?.[0]?.identifiers).toEqual([
      {
        id: "alias-1",
        label: "CORPORATION A",
        scannedName: "corporation a",
      },
    ]);
  });
});
