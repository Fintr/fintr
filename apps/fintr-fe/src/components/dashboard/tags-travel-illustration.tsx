"use client";

import type { SVGProps } from "react";

/** LinkedIn-style flat illustration — autumn in Japan (momiji, torii, soft mountains). */
export function TagsTravelIllustration({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 160 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
      {...props}
    >
      <rect width="160" height="40" fill="#F5E6D3" />
      <rect width="160" height="18" fill="#E8C9A8" opacity="0.55" />

      <path
        d="M0 28 L40 18 L80 24 L120 14 L160 22 L160 40 L0 40 Z"
        fill="#9CA3AF"
        opacity="0.35"
      />
      <path
        d="M0 32 L50 24 L100 28 L160 20 L160 40 L0 40 Z"
        fill="#6B7280"
        opacity="0.2"
      />

      <path d="M98 8 L108 8 L108 28 L103 28 L103 13 L98 13 Z" fill="#7C2D12" />
      <path d="M118 8 L123 8 L123 28 L118 28 Z" fill="#7C2D12" />
      <path
        d="M96 8 L125 8 L112.5 2 Z"
        fill="#B91C1C"
      />
      <path
        d="M100 8 L121 8 L110.5 4 Z"
        fill="#DC2626"
      />

      <ellipse cx="28" cy="22" rx="14" ry="10" fill="#92400E" opacity="0.25" />
      <path
        d="M18 26 Q28 8 38 26"
        stroke="#B45309"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22" cy="18" r="3" fill="#DC2626" />
      <circle cx="30" cy="14" r="2.5" fill="#EA580C" />
      <circle cx="34" cy="20" r="2.8" fill="#B91C1C" />
      <circle cx="26" cy="22" r="2" fill="#F59E0B" />

      <path
        d="M52 22 C54 18 58 16 62 18 C66 16 70 18 72 22"
        stroke="#92400E"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="56" cy="17" r="2.2" fill="#DC2626" />
      <circle cx="64" cy="19" r="2" fill="#EA580C" />

      <circle cx="140" cy="12" r="2.5" fill="#DC2626" opacity="0.9" />
      <circle cx="148" cy="18" r="2" fill="#F59E0B" opacity="0.85" />
      <circle cx="132" cy="16" r="1.8" fill="#B91C1C" opacity="0.8" />
      <circle cx="145" cy="10" r="1.5" fill="#EA580C" opacity="0.75" />
    </svg>
  );
}
