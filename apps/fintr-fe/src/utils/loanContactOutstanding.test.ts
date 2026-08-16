import { loanContactOutstanding } from "./loanContactOutstanding";

describe("loanContactOutstanding", () => {
  it("treats borrowed outstanding as you owe", () => {
    expect(
      loanContactOutstanding([
        {
          loanType: "borrowed",
          outstandingBalance: 12000,
          currency: "PHP",
        },
      ]),
    ).toEqual({
      youOwe: [{ currency: "PHP", amount: 12000 }],
      theyOwe: [],
    });
  });

  it("treats lent outstanding as they owe you", () => {
    expect(
      loanContactOutstanding([
        {
          loanType: "lent",
          outstandingBalance: 500,
          currency: "PHP",
        },
      ]),
    ).toEqual({
      youOwe: [],
      theyOwe: [{ currency: "PHP", amount: 500 }],
    });
  });

  it("keeps both directions instead of netting them", () => {
    expect(
      loanContactOutstanding([
        {
          loanType: "borrowed",
          outstandingBalance: 100,
          currency: "PHP",
        },
        {
          loanType: "lent",
          outstandingBalance: 40,
          currency: "PHP",
        },
      ]),
    ).toEqual({
      youOwe: [{ currency: "PHP", amount: 100 }],
      theyOwe: [{ currency: "PHP", amount: 40 }],
    });
  });

  it("groups mixed currencies instead of inventing one total", () => {
    expect(
      loanContactOutstanding([
        {
          loanType: "lent",
          outstandingBalance: 10,
          currency: "USD",
        },
        {
          loanType: "lent",
          outstandingBalance: 20,
          currency: "PHP",
        },
      ]),
    ).toEqual({
      youOwe: [],
      theyOwe: [
        { currency: "USD", amount: 10 },
        { currency: "PHP", amount: 20 },
      ],
    });
  });

  it("skips paid-off loans", () => {
    expect(
      loanContactOutstanding([
        {
          loanType: "borrowed",
          outstandingBalance: 0,
          currency: "PHP",
        },
      ]),
    ).toEqual({
      youOwe: [],
      theyOwe: [],
    });
  });
});
