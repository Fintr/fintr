import Image from "next/image";
import Link from "next/link";

const APP_STORE_URL =
  "https://apps.apple.com/ph/app/fintr-finance-tracking/id6757146677";

const BADGE_ASPECT_RATIO = 119.66407 / 40;

type AppStoreBadgeSize = "sm" | "md" | "lg";

const SIZE_CONFIG: Record<
  AppStoreBadgeSize,
  { height: number; className: string }
> = {
  sm: { height: 36, className: "h-9 w-auto" },
  md: { height: 44, className: "h-11 w-auto" },
  lg: { height: 52, className: "h-[52px] w-auto" },
};

interface AppStoreBadgeProps {
  size?: AppStoreBadgeSize;
  className?: string;
}

export function AppStoreBadge({
  size = "md",
  className = "",
}: AppStoreBadgeProps) {
  const { height, className: sizeClassName } = SIZE_CONFIG[size];
  const width = Math.round(height * BADGE_ASPECT_RATIO);

  return (
    <Link
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition-opacity hover:opacity-80 ${className}`}
    >
      <Image
        src="/images/app-store-badge.svg"
        alt="Download on the App Store"
        width={width}
        height={height}
        className={sizeClassName}
      />
    </Link>
  );
}
