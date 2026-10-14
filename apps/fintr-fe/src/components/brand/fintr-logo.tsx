"use client";

import { cn } from "@/lib/utils";

/** Bundled from `public/` — must stay on-origin for offline / Capacitor. */
export const FINTR_LOGO_LIGHT_SRC = "/fintr-logo.png";

/** Deep navy wordmark for light backgrounds. */
export const FINTR_LOGO_NAVY_SRC = "/fintr-logo-dark.png";

/** Logo on #FAFAF8 for splash / loading screens (matches native Splash.imageset). */
export const FINTR_LOGO_SPLASH_SRC = "/fintr-logo-splash.png";

/** White transparent wordmark for dark backgrounds (Fintr/Fintr-Logos). */
export const FINTR_LOGO_DARK_SRC = "/fintr-logo-white-transparent.svg";

interface FintrLogoProps {
  className?: string;
}

export function FintrLogo({ className = "h-8 w-auto" }: FintrLogoProps) {
  return (
    <>
      <img
        src={FINTR_LOGO_LIGHT_SRC}
        alt="Fintr Logo"
        className={cn(className, "dark:hidden")}
      />
      <img
        src={FINTR_LOGO_DARK_SRC}
        alt="Fintr Logo"
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}

interface LoadingFintrLogoProps {
  size?: number;
  className?: string;
  pulseClassName?: string;
}

/** Pulsing logo for bootstrap / transition loading screens; follows app theme. */
export function LoadingFintrLogo({
  size = 100,
  className,
  pulseClassName = "animate-pulse",
}: LoadingFintrLogoProps) {
  const imageStyle = { height: size, width: "auto" as const };
  const imageClassName = "block w-auto max-w-none object-contain";

  return (
    <div className={cn(pulseClassName, className)}>
      <img
        src={FINTR_LOGO_NAVY_SRC}
        alt="Fintr Logo"
        className={cn(imageClassName, "dark:hidden")}
        style={imageStyle}
      />
      <img
        src={FINTR_LOGO_DARK_SRC}
        alt="Fintr Logo"
        className={cn(imageClassName, "hidden dark:block")}
        style={imageStyle}
      />
    </div>
  );
}
