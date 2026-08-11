import { icons, Tag, type LucideIcon } from "lucide-react";

export const CATEGORY_COLOR_PALETTE = [
  "#0A3D62",
  "#1E88E5",
  "#43A047",
  "#F9A825",
  "#E53935",
  "#8E24AA",
  "#00897B",
  "#FB8C00",
  "#5E35B1",
  "#3949AB",
  "#C2185B",
  "#6D4C41",
] as const;

export const TAG_COLOR_PALETTE = CATEGORY_COLOR_PALETTE;

export const CATEGORY_DEFAULT_ICON = "tag";
export const CATEGORY_DEFAULT_COLOR = "#0A3D62";

export const CATEGORY_ICON_OPTIONS = [
  "tag",
  "briefcase",
  "laptop",
  "building-2",
  "wallet",
  "scale",
  "users",
  "shield",
  "home",
  "zap",
  "shopping-cart",
  "car",
  "dog",
  "gamepad-2",
  "utensils",
  "plane",
  "shopping-bag",
  "arrow-left-right",
  "landmark",
  "coffee",
  "heart",
  "gift",
  "book",
  "music",
  "dumbbell",
  "baby",
  "graduation-cap",
  "stethoscope",
  "wrench",
  "smartphone",
  "credit-card",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

export const CATEGORY_DEFAULTS_BY_NAME: Record<
  string,
  { icon: CategoryIconName; color: string }
> = {
  Salary: { icon: "briefcase", color: "#1E88E5" },
  Freelance: { icon: "laptop", color: "#43A047" },
  Business: { icon: "building-2", color: "#5E35B1" },
  "Initial Balance": { icon: "wallet", color: "#6D4C41" },
  "Income Adjustment": { icon: "scale", color: "#F9A825" },
  Family: { icon: "users", color: "#C2185B" },
  Insurance: { icon: "shield", color: "#3949AB" },
  Home: { icon: "home", color: "#FB8C00" },
  Utilities: { icon: "zap", color: "#F9A825" },
  "Food & Groceries": { icon: "shopping-cart", color: "#43A047" },
  Transport: { icon: "car", color: "#1E88E5" },
  Pet: { icon: "dog", color: "#6D4C41" },
  "Subscriptions & Hobbies": { icon: "gamepad-2", color: "#8E24AA" },
  "Dine Out & Entertainment": { icon: "utensils", color: "#E53935" },
  "Travel & Vacations": { icon: "plane", color: "#00897B" },
  Shopping: { icon: "shopping-bag", color: "#C2185B" },
  "Transfer Fee": { icon: "arrow-left-right", color: "#6D4C41" },
  "Expense Adjustment": { icon: "scale", color: "#F9A825" },
  Loan: { icon: "landmark", color: "#3949AB" },
  "Loan payment": { icon: "landmark", color: "#3949AB" },
};

const kebabToPascal = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export const resolveCategoryAppearance = (input: {
  name: string;
  categoryType: string;
  icon?: string | null;
  color?: string | null;
}): { icon: string; color: string } => {
  const defaults =
    CATEGORY_DEFAULTS_BY_NAME[input.name] ??
    {
      icon: CATEGORY_DEFAULT_ICON,
      color:
        CATEGORY_COLOR_PALETTE[
          `${input.categoryType}:${input.name}`
            .split("")
            .reduce((sum, char) => sum + char.charCodeAt(0), 0) %
            CATEGORY_COLOR_PALETTE.length
        ],
    };

  return {
    icon: input.icon?.trim() || defaults.icon,
    color: input.color?.trim().toUpperCase() || defaults.color,
  };
};

export const getCategoryLucideIcon = (iconName?: string | null): LucideIcon => {
  if (!iconName) {
    return Tag;
  }

  const pascalName = kebabToPascal(iconName);
  const icon = icons[pascalName as keyof typeof icons];

  return icon ?? Tag;
};
