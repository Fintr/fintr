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

    it("returns undefined so edit mode does not lock account currency", () => {
      expect(
        editLockedAccountLedgerCurrency(true, "USD Wallet", options, phpSpace),
      ).toBeUndefined();
    });
  });

  describe("edit list: every option stays selectable across currencies", () => {
    const usdOption = { value: "USD Wallet", currency: "USD" };
    const phpOption = { value: "PHP Cash", currency: "PHP" };

    it("outside edit mode, no row is currency-disabled", () => {
      const lock = editLockedAccountLedgerCurrency(false, "Cash", [], phpSpace);
      expect(
        isAccountSelectOptionDisabledForEdit(false, lock, usdOption, phpSpace),
      ).toBe(false);
      expect(
        isAccountSelectOptionDisabledForEdit(false, lock, phpOption, phpSpace),
      ).toBe(false);
    });

    it("in edit mode, accounts in other currencies remain selectable", () => {
      expect(
        isAccountSelectOptionDisabledForEdit(true, "PHP", usdOption, phpSpace),
      ).toBe(false);
      expect(
        isAccountSelectOptionDisabledForEdit(true, "USD", phpOption, phpSpace),
      ).toBe(false);
    });
  });
});
