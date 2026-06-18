"use client";

import React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const SUN_RAY_COUNT = 12;
const SUN_RAYS = Array.from({ length: SUN_RAY_COUNT }, (_, index) => index);
const RAY_WIDTH_PX = 5;
const RAY_SHORT_LENGTH_PX = 10;
const RAY_LONG_LENGTH_PX = RAY_SHORT_LENGTH_PX + 10;
const RAY_GAP_FROM_AVATAR_PX = 8;

const avatarSurfaceClassName = cn(
  "relative z-10 h-20 w-20 rounded-full ring-2 ring-primary/15",
  "md:h-24 md:w-24",
);

interface ProfileSunAvatarProps {
  src?: string | null;
  alt: string;
  name?: string | null;
  className?: string;
}

const getProfileInitials = (name?: string | null): string | null => {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return null;
  }

  const parts = trimmedName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function ProfileSunAvatar({
  src,
  alt,
  name,
  className,
}: ProfileSunAvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const initials = getProfileInitials(name);
  const showImage = Boolean(src) && !imageFailed;

  React.useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative mb-1 flex h-36 w-36 items-center justify-center",
        "md:h-40 md:w-40",
        "[--avatar-radius:40px] md:[--avatar-radius:48px]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          "animate-[spin_20s_linear_infinite]",
          "motion-reduce:animate-none",
        )}
      >
        {SUN_RAYS.map((index) => {
          const isLongRay = index % 2 === 1;
          const rayLengthPx = isLongRay ? RAY_LONG_LENGTH_PX : RAY_SHORT_LENGTH_PX;
          const angle = (index * 360) / SUN_RAY_COUNT;
          const rayDistance = `calc(var(--avatar-radius) + ${RAY_GAP_FROM_AVATAR_PX}px + ${rayLengthPx / 2}px)`;

          return (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 rounded-full bg-primary dark:bg-primary-dark-mode"
              style={{
                width: `${RAY_WIDTH_PX}px`,
                height: `${rayLengthPx}px`,
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * ${rayDistance}))`,
              }}
            />
          );
        })}
      </div>

      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          className={cn(avatarSurfaceClassName, "object-cover")}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={cn(
            avatarSurfaceClassName,
            "flex items-center justify-center bg-primary/10",
          )}
          role="img"
          aria-label={alt}
        >
          {initials ? (
            <span className="text-lg font-semibold text-primary md:text-xl">
              {initials}
            </span>
          ) : (
            <User
              className="h-8 w-8 text-primary md:h-10 md:w-10"
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  );
}
