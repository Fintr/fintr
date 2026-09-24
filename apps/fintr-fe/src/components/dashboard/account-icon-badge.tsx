import React from "react";
import { cn } from "@/lib/utils";
import { getAccountCategoryIcon } from "@/utils/accountCategoryIcon";

type AccountIconBadgeProps = {
  accountCategory?: string | null;
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

export const AccountIconBadge: React.FC<AccountIconBadgeProps> = ({
  accountCategory,
  className,
  iconClassName,
  size = "md",
}) => {
  const Icon = getAccountCategoryIcon(accountCategory ?? "cash");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground",
        sizeClasses[size].container,
        className,
      )}
      aria-hidden
    >
      <Icon className={cn(sizeClasses[size].icon, iconClassName)} />
    </span>
  );
};
