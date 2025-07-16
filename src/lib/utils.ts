import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencyCode: string = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

// Generate random colors for charts
export const getRandomColor = () => {
  const colors = [
    "#11A69C", // Teal
    "#924AF7", // Purple
    "#D17711", // Orange
    "#0081FE", // Blue
    "#FF5383", // Pink
    "#00AB55", // Green
    "#400387", // Dark Purple
    "#F2681F", // Dark Orange
    "#005062", // Dark Teal
    "#DE2C62", // Dark Pink
    "#660E00", // Dark Red-Brown
    "#003C96", // Darker Blue
  ];
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
};
