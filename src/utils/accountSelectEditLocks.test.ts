import { describe, it, expect } from "vitest";
import {
  optionLedgerCurrencyForEditLock,
  editLockedAccountLedgerCurrency,
  isAccountSelectOptionDisabledForEdit,
} from "./accountSelectEditLocks";

const phpSpace = "PHP";

describe("accountSelectEditLocks", () => {
  describe("optionLedgerCurrencyForEditLock", () => {
    it("uses each row's currency when the API provided one", () => {
      expect(
        optionLedgerCurrencyForEditLock(
          { value: "a", currency: "USD" },
          phpSpace,
        ),
      ).toBe("USD");
    });

    it("uses space currency when a row has no currency field", () => {
      expect(
        optionLedgerCurrencyForEditLock({ value: "a" }, phpSpace),
      ).toBe(phpSpace);
    });
  });

  describe("editLockedAccountLedgerCurrency", () => {
    const options = [
      { value: "Cash", currency: "PHP" },
      { value: "USD Wallet", currency: "USD" },
    ];

    it("resolves lock from the initial account row (USD wallet)", () => {
      expect(
        editLockedAccountLedgerCurrency(true, "USD Wallet", options, phpSpace),
      ).toBe("USD");
    });

    it("uses space currency for an initial account row without currency metadata", () => {
      expect(
        editLockedAccountLedgerCurrency(
          true,
          "Legacy",
          [{ value: "Legacy" }],
          phpSpace,
        ),
      ).toBe(phpSpace);
    });
  });

  describe("edit list: every option stays in the list; wrong currency is disabled only", () => {
    const usdOption = { value: "USD Wallet", currency: "USD" };
    const phpOption = { value: "PHP Cash", currency: "PHP" };

    it("outside edit mode, no row is currency-disabled (all remain selectable)", () => {
      const lock = editLockedAccountLedgerCurrency(false, "Cash", [], phpSpace);
      expect(
        isAccountSelectOptionDisabledForEdit(false, lock, usdOption, phpSpace),
      ).toBe(false);
      expect(
        isAccountSelectOptionDisabledForEdit(false, lock, phpOption, phpSpace),
      ).toBe(false);
    });

    it("in edit mode with a PHP lock, USD rows are disabled and PHP rows stay enabled", () => {
      const lock = "PHP";
      expect(
        isAccountSelectOptionDisabledForEdit(true, lock, usdOption, phpSpace),
      ).toBe(true);
      expect(
        isAccountSelectOptionDisabledForEdit(true, lock, phpOption, phpSpace),
      ).toBe(false);
    });

    it("in edit mode with a USD lock, PHP rows are disabled and USD rows stay enabled", () => {
      const lock = "USD";
      expect(
        isAccountSelectOptionDisabledForEdit(true, lock, phpOption, phpSpace),
      ).toBe(true);
      expect(
        isAccountSelectOptionDisabledForEdit(true, lock, usdOption, phpSpace),
      ).toBe(false);
    });

    it("when no currency lock applies, no row is disabled by currency (all stay selectable)", () => {
      expect(
        isAccountSelectOptionDisabledForEdit(
          true,
          undefined,
          usdOption,
          phpSpace,
        ),
      ).toBe(false);
    });
  });
});
