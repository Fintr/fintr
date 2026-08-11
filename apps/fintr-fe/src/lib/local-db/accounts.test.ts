import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { Account } from "@/types/accountTypes";

import {
  clearSpaceAccounts,
  getAccountsSyncedAt,
  listSpaceAccounts,
  replaceSpaceAccounts,
} from "./accounts";
import {
  closeLocalDbInstanceForTests,
  getLocalDbSchemaVersion,
  resetLocalDbForTests,
} from "./db";

const sampleAccounts = (): Account[] => [
  {
    id: "acc-1",
    name: "Cash",
    balance: "100.00",
    balanceCurrency: "PHP",
    accountCategory: "cash",
  },
  {
    id: "acc-2",
    name: "Bank",
    balance: "250.50",
    balanceCurrency: "PHP",
    accountCategory: "savings",
  },
];

describe("local-db accounts cache (IndexedDB)", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("applies schema version 2", async () => {
    expect(await getLocalDbSchemaVersion()).toBe(2);
  });

  it("replaces and lists accounts for a space", async () => {
    await replaceSpaceAccounts("space-a", sampleAccounts());

    const listed = await listSpaceAccounts("space-a");

    expect(listed).toHaveLength(2);
    expect(listed.map((account) => account.name)).toEqual(["Bank", "Cash"]);
    expect(await getAccountsSyncedAt("space-a")).toEqual(expect.any(Number));
  });

  it("scopes cache by spaceId", async () => {
    await replaceSpaceAccounts("space-a", sampleAccounts());
    await replaceSpaceAccounts("space-b", [
      {
        id: "acc-b",
        name: "Only B",
        balance: "1.00",
        balanceCurrency: "PHP",
        accountCategory: "cash",
      },
    ]);

    expect(await listSpaceAccounts("space-a")).toHaveLength(2);
    expect(await listSpaceAccounts("space-b")).toHaveLength(1);
    expect((await listSpaceAccounts("space-b"))[0]?.name).toBe("Only B");
  });

  it("clears a space without touching another", async () => {
    await replaceSpaceAccounts("space-a", sampleAccounts());
    await replaceSpaceAccounts("space-b", [
      {
        id: "acc-b",
        name: "Space B Cash",
        balance: "1.00",
        balanceCurrency: "PHP",
        accountCategory: "cash",
      },
    ]);

    await clearSpaceAccounts("space-a");

    expect(await listSpaceAccounts("space-a")).toEqual([]);
    expect(await getAccountsSyncedAt("space-a")).toBeNull();
    expect(await listSpaceAccounts("space-b")).toHaveLength(1);
  });

  it("persists across db handle reopen", async () => {
    await replaceSpaceAccounts("space-a", sampleAccounts());
    closeLocalDbInstanceForTests();

    const listed = await listSpaceAccounts("space-a");
    expect(listed).toHaveLength(2);
    expect(listed.map((account) => account.name)).toEqual(["Bank", "Cash"]);
  });
});
