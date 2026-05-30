"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingFintrLogo } from "@/components/brand/fintr-logo";
import { shouldRedirectHomeToAuth } from "@/lib/capacitor";

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
        <LoadingFintrLogo
          size={120}
          pulseClassName="animate-pulse-logo"
          className="drop-shadow-lg"
        />
      </div>
    );
  }

  return <>{children}</>;
}
