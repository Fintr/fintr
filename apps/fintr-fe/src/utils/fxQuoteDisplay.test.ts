import { describe, expect, it } from "vitest";
import {
  humanFxQuote,
  operativeMultiplierFromFinalAmount,
  operativeMultiplierFromManualQuote,
  formatFxQuoteCompact,
} from "./fxQuoteDisplay";

describe("humanFxQuote", () => {
  it("shows direct quote when operative multiplier is >= 1", () => {
    expect(humanFxQuote(58, "USD", "PHP")).toEqual({
      displayValue: 58,
      unitCurrency: "PHP",
      baseCurrency: "USD",
    });
  });

  it("inverts quote when operative multiplier is < 1", () => {
    const quote = humanFxQuote(0.00233, "VND", "PHP");

    expect(quote.unitCurrency).toBe("VND");
    expect(quote.baseCurrency).toBe("PHP");
    expect(quote.displayValue).toBeCloseTo(429.185, 1);
  });
});

describe("formatFxQuoteCompact", () => {
  it("shows PHP amount per 1 USD when multiplier is direct", () => {
    expect(
      formatFxQuoteCompact(62, "USD", "PHP", (n) => String(n)),
    ).toBe("PHP 62 to 1 USD");
  });

  it("inverts when multiplier is fractional", () => {
    expect(
      formatFxQuoteCompact(1 / 62, "PHP", "USD", (n) => n.toFixed(0)),
    ).toBe("PHP 62 to 1 USD");
  });
});

describe("operativeMultiplierFromManualQuote", () => {
  it("divides when hint rate uses inverted display (VND → PHP)", () => {
    expect(operativeMultiplierFromManualQuote(405, 0.00233)).toBeCloseTo(
      1 / 405,
      6,
    );
  });

  it("uses entered value directly when hint rate uses direct display (USD → PHP)", () => {
    expect(operativeMultiplierFromManualQuote(58, 58)).toBe(58);
  });

  it("falls back to direct entry for USD → PHP without a hint", () => {
    expect(operativeMultiplierFromManualQuote(58, null)).toBe(58);
  });

  it("falls back to inverted entry for VND → PHP without a hint", () => {
    expect(operativeMultiplierFromManualQuote(405, null)).toBeCloseTo(
      1 / 405,
      6,
    );
  });
});

describe("operativeMultiplierFromFinalAmount", () => {
  it("returns target total divided by source amount", () => {
    expect(operativeMultiplierFromFinalAmount(100, 8285)).toBe(82.85);
  });

  it("returns null when source amount is zero", () => {
    expect(operativeMultiplierFromFinalAmount(0, 100)).toBeNull();
  });
});
