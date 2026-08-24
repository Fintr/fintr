import { describe, expect, it } from "vitest";

import {
  fuzzyResolveAccountIdForName,
  resolveAccountIdForName,
  type AccountNameResolver,
} from "./account-name-resolver";

describe("account name resolver", () => {
  it("resolves prior account names from previousNames", () => {
    const resolvers: AccountNameResolver[] = [
      {
        id: "acc-bdo",
        names: new Set(["bdo - ella2", "bdo - ella"]),
      },
    ];

    expect(resolveAccountIdForName(resolvers, "BDO - Ella")).toBe("acc-bdo");
    expect(resolveAccountIdForName(resolvers, "BDO - Ella2")).toBe("acc-bdo");
  });

  it("fuzzy-matches renamed accounts when only one candidate shares a prefix", () => {
    const accounts = [
      { id: "acc-bdo", name: "BDO - Ella2" },
      { id: "acc-cash", name: "Cash" },
    ];

    expect(fuzzyResolveAccountIdForName(accounts, "BDO - Ella")).toBe(
      "acc-bdo",
    );
    expect(fuzzyResolveAccountIdForName(accounts, "Groceries")).toBeNull();
  });
});
