import { describe, expect, it } from "vitest";

import { overlayAccountOptionBalances } from "./overlay-account-option-balances";

describe("overlayAccountOptionBalances", () => {
  it("replaces a stale picker balance with the accounts-list balance", () => {
    const overlaid = overlayAccountOptionBalances(
      [
        {
          label: "EastWest",
          value: "EastWest",
          currency: "PHP",
          accountCategory: "debit",
          balance: -24430110.77,
        },
        {
          label: "GCash",
          value: "GCash",
          currency: "PHP",
          accountCategory: "e_wallet",
          balance: 16473.52,
        },
      ],
      [
        {
          id: "acc-eastwest",
          name: "EastWest",
          balance: "569889.23",
          balanceCurrency: "PHP",
          accountCategory: "debit",
        },
        {
          id: "acc-gcash",
          name: "GCash",
          balance: "16473.52",
          balanceCurrency: "PHP",
          accountCategory: "e_wallet",
        },
      ],
    );

    expect(
      Number(overlaid.find((option) => option.value === "EastWest")?.balance),
    ).toBe(569889.23);
    expect(
      Number(overlaid.find((option) => option.value === "GCash")?.balance),
    ).toBe(16473.52);
  });

  it("returns the original options when no accounts are available", () => {
    const options = [
      {
        label: "EastWest",
        value: "EastWest",
        balance: -24430110.77,
      },
    ];

    expect(overlayAccountOptionBalances(options, [])).toBe(options);
  });
});
