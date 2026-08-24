import { icons } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_DEFAULT_COLOR,
  CATEGORY_DEFAULT_ICON,
  CATEGORY_ICON_OPTIONS,
  filterCategoryIconOptions,
  getCategoryIconLabel,
  getCategoryLucideIcon,
  resolveCategoryAppearance,
} from "./categoryAppearance";

const kebabToPascal = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

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

  it("offers more than 100 category icons", () => {
    expect(CATEGORY_ICON_OPTIONS.length).toBeGreaterThan(100);
  });

  it("maps every category icon option to a valid lucide component", () => {
    CATEGORY_ICON_OPTIONS.forEach((iconName) => {
      const resolvedName = iconName === "home" ? "house" : iconName;
      const pascalName = kebabToPascal(resolvedName);
      const expectedIcon = icons[pascalName as keyof typeof icons];

      expect(expectedIcon).toBeTruthy();
      expect(getCategoryLucideIcon(iconName)).toBe(expectedIcon);
    });
  });

  it("resolves legacy home icon alias to house", () => {
    expect(getCategoryLucideIcon("home")).toBe(icons.House);
  });

  it("returns human-readable labels for icons", () => {
    expect(getCategoryIconLabel("shopping-cart")).toBe("Shopping Cart");
    expect(getCategoryIconLabel("zap")).toBe("Utilities");
    expect(getCategoryIconLabel("fuel")).toBe("Fuel");
  });

  it("filters icons by label, id, and keywords", () => {
    expect(filterCategoryIconOptions("")).toHaveLength(CATEGORY_ICON_OPTIONS.length);
    expect(filterCategoryIconOptions("petrol")).toContain("fuel");
    expect(filterCategoryIconOptions("utilities")).toContain("zap");
    expect(filterCategoryIconOptions("shopping cart")).toContain("shopping-cart");
    expect(filterCategoryIconOptions("xyz-not-found")).toEqual([]);
  });

  it("keeps the selected icon visible when it does not match the search", () => {
    expect(
      filterCategoryIconOptions("xyz-not-found", { selectedIcon: "coffee" }),
    ).toEqual(["coffee"]);
  });
});
