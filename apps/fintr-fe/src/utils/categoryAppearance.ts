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
  "fuel",
  "bus",
  "bike",
  "train-front",
  "tram-front",
  "parking-meter",
  "car-front",
  "ship",
  "piggy-bank",
  "banknote",
  "receipt",
  "coins",
  "circle-dollar-sign",
  "hand-coins",
  "trending-up",
  "chart-line",
  "chart-pie",
  "pill",
  "hospital",
  "heart-pulse",
  "activity",
  "syringe",
  "glasses",
  "pizza",
  "wine",
  "beer",
  "ice-cream-cone",
  "apple",
  "cookie",
  "film",
  "tv",
  "headphones",
  "camera",
  "ticket",
  "clapperboard",
  "shirt",
  "gem",
  "scissors",
  "store",
  "shopping-basket",
  "watch",
  "sparkles",
  "cat",
  "fish",
  "bird",
  "paw-print",
  "hammer",
  "lamp",
  "bed-double",
  "bath",
  "refrigerator",
  "tree-pine",
  "droplets",
  "flame",
  "lightbulb",
  "wifi",
  "cloud",
  "tent",
  "luggage",
  "map-pin",
  "compass",
  "umbrella",
  "sun",
  "school",
  "book-open",
  "printer",
  "monitor",
  "church",
  "handshake",
  "globe",
  "palette",
  "package",
  "truck",
  "key",
  "phone",
  "mail",
  "trophy",
  "star",
  "anchor",
  "leaf",
  "rocket",
  "backpack",
  "paintbrush",
  "flower-2",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

const CATEGORY_ICON_LABEL_OVERRIDES: Partial<Record<CategoryIconName, string>> = {
  zap: "Utilities",
  "arrow-left-right": "Transfer",
  "gamepad-2": "Gaming",
  "building-2": "Building",
  "circle-dollar-sign": "Dollar Sign",
  "hand-coins": "Tips",
  "heart-pulse": "Health",
  "ice-cream-cone": "Ice Cream",
  "bed-double": "Bed",
  "tree-pine": "Tree",
  "book-open": "Book",
  "flower-2": "Flower",
  "paw-print": "Paw Print",
  "train-front": "Train",
  "tram-front": "Tram",
  "parking-meter": "Parking",
  "graduation-cap": "Graduation",
  "trending-up": "Investments",
  "chart-line": "Chart",
  "chart-pie": "Budget Chart",
};

const CATEGORY_ICON_KEYWORDS: Partial<Record<CategoryIconName, readonly string[]>> = {
  tag: ["default", "misc", "other"],
  briefcase: ["work", "job", "salary", "office"],
  laptop: ["freelance", "remote", "computer"],
  "building-2": ["business", "company", "office"],
  wallet: ["cash", "money"],
  scale: ["balance", "adjustment"],
  users: ["family", "people"],
  shield: ["insurance", "protection"],
  home: ["house", "housing", "rent", "mortgage"],
  zap: ["electricity", "power", "utilities"],
  "shopping-cart": ["groceries", "food", "supermarket"],
  car: ["transport", "vehicle", "auto"],
  dog: ["pet"],
  "gamepad-2": ["gaming", "hobbies", "games"],
  utensils: ["dining", "restaurant", "food"],
  plane: ["travel", "flight", "vacation"],
  "shopping-bag": ["retail", "shopping"],
  "arrow-left-right": ["transfer"],
  landmark: ["bank", "loan"],
  coffee: ["cafe", "drink"],
  heart: ["love", "health"],
  gift: ["presents"],
  book: ["reading"],
  music: ["audio"],
  dumbbell: ["gym", "fitness", "exercise"],
  baby: ["child", "kids"],
  "graduation-cap": ["education", "school", "university"],
  stethoscope: ["doctor", "medical"],
  wrench: ["repair", "maintenance", "tools"],
  smartphone: ["mobile", "phone"],
  "credit-card": ["payment", "card"],
  fuel: ["gas", "petrol", "gasoline"],
  bus: ["transit", "public transport"],
  bike: ["cycling", "bicycle"],
  "train-front": ["train", "railway", "metro"],
  "tram-front": ["tram", "streetcar"],
  "parking-meter": ["parking"],
  "car-front": ["vehicle", "automobile"],
  ship: ["cruise", "boat", "ferry"],
  "piggy-bank": ["savings"],
  banknote: ["cash", "money"],
  receipt: ["bill", "invoice"],
  coins: ["change", "money"],
  "circle-dollar-sign": ["finance", "money", "dollar"],
  "hand-coins": ["tips", "donation"],
  "trending-up": ["investment", "stocks", "growth"],
  "chart-line": ["stocks", "analytics"],
  "chart-pie": ["budget", "analytics"],
  pill: ["pharmacy", "medicine"],
  hospital: ["medical", "healthcare"],
  "heart-pulse": ["health", "fitness"],
  activity: ["fitness", "exercise", "workout"],
  syringe: ["vaccine", "medical"],
  glasses: ["vision", "eyewear"],
  pizza: ["food", "fast food"],
  wine: ["alcohol", "drink"],
  beer: ["alcohol", "drink"],
  "ice-cream-cone": ["dessert", "sweets"],
  apple: ["fruit", "healthy"],
  cookie: ["dessert", "snack"],
  film: ["movies", "cinema"],
  tv: ["television", "streaming"],
  headphones: ["audio", "music"],
  camera: ["photography"],
  ticket: ["events", "concert"],
  clapperboard: ["movies"],
  shirt: ["clothing", "clothes", "fashion"],
  gem: ["jewelry", "jewels"],
  scissors: ["haircut", "salon"],
  store: ["shop", "retail"],
  "shopping-basket": ["groceries"],
  watch: ["accessories", "time"],
  sparkles: ["beauty", "spa", "cosmetics"],
  cat: ["pet"],
  fish: ["pet", "aquarium"],
  bird: ["pet"],
  "paw-print": ["pet", "animal"],
  hammer: ["diy", "renovation", "repair"],
  lamp: ["furniture", "lighting"],
  "bed-double": ["hotel", "accommodation", "sleep"],
  bath: ["bathroom"],
  refrigerator: ["fridge", "kitchen", "appliances"],
  "tree-pine": ["garden", "outdoor"],
  droplets: ["water", "plumbing"],
  flame: ["gas", "heating"],
  lightbulb: ["electricity"],
  wifi: ["internet", "broadband"],
  cloud: ["hosting", "saas"],
  tent: ["camping", "outdoor"],
  luggage: ["travel", "vacation"],
  "map-pin": ["location", "local"],
  compass: ["navigation", "travel"],
  umbrella: ["weather", "rain"],
  sun: ["vacation", "holiday", "summer"],
  school: ["education"],
  "book-open": ["reading", "learning"],
  printer: ["office", "supplies"],
  monitor: ["computer", "display"],
  church: ["religion", "donation", "charity"],
  handshake: ["charity", "deal", "agreement"],
  globe: ["international", "world", "travel"],
  palette: ["art", "design", "creative"],
  package: ["shipping", "delivery", "parcel"],
  truck: ["delivery", "shipping"],
  key: ["rent", "security"],
  phone: ["mobile", "telephone"],
  mail: ["email", "postage"],
  trophy: ["sports", "award"],
  star: ["favorite", "rating"],
  anchor: ["nautical", "marine"],
  leaf: ["eco", "green", "nature"],
  rocket: ["startup", "space"],
  backpack: ["school", "hiking"],
  paintbrush: ["art", "painting"],
  "flower-2": ["garden", "plants", "florist"],
};

const formatIconLabel = (iconName: string): string =>
  iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getCategoryIconLabel = (iconName: string): string => {
  const knownName = iconName as CategoryIconName;
  return CATEGORY_ICON_LABEL_OVERRIDES[knownName] ?? formatIconLabel(iconName);
};

const iconMatchesQuery = (iconName: CategoryIconName, query: string): boolean => {
  const label = getCategoryIconLabel(iconName).toLowerCase();
  const keywords = CATEGORY_ICON_KEYWORDS[iconName] ?? [];

  return (
    iconName.includes(query) ||
    label.includes(query) ||
    keywords.some((keyword) => keyword.includes(query) || query.includes(keyword))
  );
};

export const filterCategoryIconOptions = (
  query: string,
  options?: { selectedIcon?: string | null },
): CategoryIconName[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const matches =
    normalizedQuery.length === 0
      ? [...CATEGORY_ICON_OPTIONS]
      : CATEGORY_ICON_OPTIONS.filter((iconName) =>
          iconMatchesQuery(iconName, normalizedQuery),
        );

  const selectedIcon = options?.selectedIcon;
  if (
    selectedIcon &&
    CATEGORY_ICON_OPTIONS.includes(selectedIcon as CategoryIconName) &&
    !matches.includes(selectedIcon as CategoryIconName)
  ) {
    return [selectedIcon as CategoryIconName, ...matches];
  }

  return matches;
};

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

const ICON_ALIASES: Record<string, string> = {
  home: "house",
};

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

  const normalizedName = ICON_ALIASES[iconName] ?? iconName;
  const pascalName = kebabToPascal(normalizedName);
  const icon = icons[pascalName as keyof typeof icons];

  return icon ?? Tag;
};
