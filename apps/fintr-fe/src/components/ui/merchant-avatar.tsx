"use client";

import React from "react";
import { Store } from "lucide-react";

import { cn } from "@/lib/utils";
import { downloadPublicFileCopy } from "@/services/attachments/download-remote";

type MerchantAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  fileUrl?: string | null;
  size?: number;
  className?: string;
};

const getInitials = (name?: string | null): string | null => {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function MerchantAvatar({
  name,
  photoUrl,
  fileUrl,
  size = 40,
  className,
}: MerchantAvatarProps) {
  const [src, setSrc] = React.useState(photoUrl);
  const [imageFailed, setImageFailed] = React.useState(false);
  const initials = getInitials(name);
  const showImage = Boolean(src) && !imageFailed;

  React.useEffect(() => {
    setSrc(photoUrl);
    setImageFailed(false);
  }, [photoUrl, fileUrl]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => {
            if (!fileUrl || src === fileUrl) {
              setImageFailed(true);
              return;
            }

            void downloadPublicFileCopy(fileUrl).then((downloaded) => {
              if (downloaded) {
                setSrc(downloaded);
                return;
              }
              setImageFailed(true);
            });
          }}
        />
      ) : initials ? (
        <span
          className="font-semibold"
          style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}
        >
          {initials}
        </span>
      ) : (
        <Store
          style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }}
        />
      )}
    </div>
  );
}
