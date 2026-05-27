"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { shouldRedirectHomeToAuth } from "@/lib/capacitor";

const FINTR_LOGO_SRC =
  "https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png";

type Status = "pending" | "redirecting" | "show";

const initialStatus = (): Status =>
  typeof navigator !== "undefined" && shouldRedirectHomeToAuth()
    ? "redirecting"
    : "show";

/**
 * When running inside the native Fintr Capacitor app (iOS/Android), redirects to /auth
 * and does not render children so the front page is never shown.
 * In any browser (desktop or mobile), renders the marketing homepage immediately.
 */
export default function CapacitorRedirectToAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    if (!shouldRedirectHomeToAuth()) {
      setStatus("show");
      return;
    }

    setStatus("redirecting");
    router.replace("/auth");
  }, [router]);

  if (status === "redirecting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="animate-pulse-logo">
          <Image
            src={FINTR_LOGO_SRC}
            alt="Fintr"
            width={120}
            height={120}
            className="drop-shadow-lg"
            priority
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
