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

  it("appends an account in another currency without changing existing option currencies", () => {
    const overlaid = overlayAccountOptionBalances(
      [
        {
          label: "Cash",
          value: "Cash",
          currency: "PHP",
          accountCategory: "cash",
          balance: "1000",
        },
      ],
      [
        {
          id: "acc-cash",
          name: "Cash",
          balance: "1000",
          balanceCurrency: "PHP",
          accountCategory: "cash",
        },
        {
          id: "acc-usd",
          name: "USD Wallet",
          balance: "50",
          balanceCurrency: "USD",
          accountCategory: "cash",
        },
      ],
    );

    expect(overlaid.find((option) => option.value === "Cash")?.currency).toBe(
      "PHP",
    );
    expect(
      overlaid.find((option) => option.value === "USD Wallet"),
    ).toMatchObject({
      currency: "USD",
      balance: "50",
    });
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
