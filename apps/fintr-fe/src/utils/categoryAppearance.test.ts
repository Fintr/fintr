import { describe, expect, it } from "vitest";
import {
  CATEGORY_DEFAULT_COLOR,
  CATEGORY_DEFAULT_ICON,
  getCategoryLucideIcon,
  resolveCategoryAppearance,
} from "./categoryAppearance";

describe("categoryAppearance", () => {
  it("resolves known default categories", () => {
    expect(
      resolveCategoryAppearance({
        name: "Food & Groceries",
        categoryType: "expense",
      }),
    ).toEqual({
      icon: "shopping-cart",
      color: "#43A047",
    });
  });

  it("uses provided icon and color when present", () => {
    expect(
      resolveCategoryAppearance({
        name: "Custom",
        categoryType: "expense",
        icon: "coffee",
        color: "#abcdef",
      }),
    ).toEqual({
      icon: "coffee",
      color: "#ABCDEF",
    });
  });

  it("falls back to generated defaults for unknown categories", () => {
    const result = resolveCategoryAppearance({
      name: "My Category",
      categoryType: "income",
    });

    expect(result.icon).toBe(CATEGORY_DEFAULT_ICON);
    expect(result.color).not.toBe(CATEGORY_DEFAULT_COLOR);
  });

  it("maps icon names to lucide components", () => {
    expect(getCategoryLucideIcon("shopping-cart")).toBeTruthy();
    expect(getCategoryLucideIcon("invalid-icon")).toBeTruthy();
  });
});
