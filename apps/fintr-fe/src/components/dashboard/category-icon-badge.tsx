import React from "react";
import { cn } from "@/lib/utils";
import { getCategoryLucideIcon } from "@/utils/categoryAppearance";

type CategoryIconBadgeProps = {
  icon?: string | null;
  color?: string | null;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: {
    container: "h-8 w-8",
    icon: "h-4 w-4",
  },
  md: {
    container: "h-10 w-10",
    icon: "h-5 w-5",
  },
};

export const CategoryIconBadge: React.FC<CategoryIconBadgeProps> = ({
  icon,
  color,
  className,
  iconClassName,
  size = "md",
}) => {
  const Icon = getCategoryLucideIcon(icon);
  const backgroundColor = color ?? "#0A3D62";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        sizeClasses[size].container,
        className,
      )}
      style={{ backgroundColor: `${backgroundColor}20`, color: backgroundColor }}
      aria-hidden
    >
      <Icon className={cn(sizeClasses[size].icon, iconClassName)} />
    </span>
  );
};
