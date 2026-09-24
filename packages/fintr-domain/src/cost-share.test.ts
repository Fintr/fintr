import { describe, expect, it } from "vitest";

import {
  allocateCostShare,
  assertAllocateCostShare,
} from "./cost-share";

describe("allocateCostShare", () => {
  describe("equal", () => {
    it("splits 1000 equally with one person", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "equal",
        participants: [{ entityName: "Entity A" }],
      });

      expect(result.yourShare).toBe(500);
      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 500 },
      ]);
    });

    it("puts leftover cents on your share when the bill does not divide evenly", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "equal",
        participants: [
          { entityName: "Entity A" },
          { entityName: "Entity B" },
        ],
      });

      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 333.33 },
        { entityName: "Entity B", amount: 333.33 },
      ]);
      expect(result.yourShare).toBe(333.34);
      expect(
        result.yourShare
        + result.participants.reduce((sum, person) => sum + person.amount, 0),
      ).toBe(1000);
    });
  });

  describe("amount", () => {
    it("uses each person's amount and gives you the remainder", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "amount",
        participants: [
          { entityName: "Entity A", amount: 400 },
          { entityName: "Entity B", amount: 250 },
        ],
      });

      expect(result.yourShare).toBe(350);
      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 400 },
        { entityName: "Entity B", amount: 250 },
      ]);
    });
  });

  describe("percent", () => {
    it("converts each person's percent and gives you the leftover percent", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "percent",
        participants: [
          { entityName: "Entity A", percent: 30 },
          { entityName: "Entity B", percent: 20 },
        ],
      });

      expect(result.yourShare).toBe(500);
      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 300 },
        { entityName: "Entity B", amount: 200 },
      ]);
    });
  });

  describe("validation", () => {
    it("rejects an empty participant list", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "equal",
          participants: [],
        }),
      ).toThrow(/people/i);
    });

    it("rejects duplicate participant names", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "equal",
          participants: [
            { entityName: "Entity A" },
            { entityName: "entity a" },
          ],
        }),
      ).toThrow(/duplicate/i);
    });

    it("allows others to take the whole bill", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "amount",
        participants: [{ entityName: "Entity A", amount: 1000 }],
      });

      expect(result.yourShare).toBe(0);
      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 1000 },
      ]);
    });

    it("rejects an amount above the bill total", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "amount",
          participants: [{ entityName: "Entity A", amount: 1000.01 }],
        }),
      ).toThrow(/more than the total/i);
    });

    it("rejects amounts that together exceed the bill total", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "amount",
          participants: [
            { entityName: "Entity A", amount: 600 },
            { entityName: "Entity B", amount: 500 },
          ],
        }),
      ).toThrow(/more than the total/i);
    });

    it("allows a percent share of 100", () => {
      const result = allocateCostShare({
        totalAmount: 1000,
        mode: "percent",
        participants: [{ entityName: "Entity A", percent: 100 }],
      });

      expect(result.yourShare).toBe(0);
      expect(result.participants).toEqual([
        { entityName: "Entity A", amount: 1000 },
      ]);
    });

    it("rejects a percent above 100", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "percent",
          participants: [{ entityName: "Entity A", percent: 100.01 }],
        }),
      ).toThrow(/100/i);
    });

    it("rejects a percent below 0.01", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "percent",
          participants: [{ entityName: "Entity A", percent: 0.009 }],
        }),
      ).toThrow(/0\.01/i);
    });

    it("rejects percents that total more than 100", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "percent",
          participants: [
            { entityName: "Entity A", percent: 60 },
            { entityName: "Entity B", percent: 50 },
          ],
        }),
      ).toThrow(/100/i);
    });

    it("rejects a non-positive participant share", () => {
      expect(() =>
        allocateCostShare({
          totalAmount: 1000,
          mode: "amount",
          participants: [{ entityName: "Entity A", amount: 0 }],
        }),
      ).toThrow(/greater than 0/i);
    });
  });
});

describe("assertAllocateCostShare", () => {
  it("throws the local-first validation shape", () => {
    expect(() =>
      assertAllocateCostShare({
        totalAmount: 1000,
        mode: "equal",
        participants: [],
      }),
    ).toThrow(
      expect.objectContaining({
        success: false,
        message: "Validation failed",
        details: expect.objectContaining({
          participants: expect.any(Array),
        }),
      }),
    );
  });
});
