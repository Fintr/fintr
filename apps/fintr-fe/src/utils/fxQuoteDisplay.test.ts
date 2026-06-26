import { describe, expect, it } from "vitest";
import {
  humanFxQuote,
  operativeMultiplierFromManualQuote,
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
