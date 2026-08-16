"use client";

import { useState } from "react";

import { useShellCachedImageSrc } from "@/hooks/useShellCachedImageSrc";
import { badgeImageForKey } from "@/lib/badges/catalog";
import { resolveShellCachedAssetObjectUrl } from "@/lib/insights/resolve-shell-cached-asset";
import { cn } from "@/lib/utils";

interface BadgeImageProps {
  imageKey: string;
  alt: string;
  className?: string;
}

export const BadgeImage = ({
  imageKey,
  alt,
  className,
}: BadgeImageProps) => {
  const networkPath = badgeImageForKey(imageKey);
  const { src: resolvedSrc } = useShellCachedImageSrc(networkPath);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const displaySrc = fallbackSrc ?? resolvedSrc;

  const handleError = () => {
    void (async () => {
      const cachedObjectUrl = await resolveShellCachedAssetObjectUrl(networkPath);

      if (cachedObjectUrl) {
        setFailed(false);
        setFallbackSrc(cachedObjectUrl);
        return;
      }

      setFailed(true);
    })();
  };

  if (!displaySrc || failed) {
    return null;
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={cn(
        "absolute inset-0 h-full w-full object-cover",
        className,
      )}
      onError={handleError}
    />
  );
};
