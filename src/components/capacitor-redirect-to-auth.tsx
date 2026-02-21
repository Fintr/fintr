"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isNativeCapacitor } from "@/lib/capacitor";

const FINTR_LOGO_SRC =
  "https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png";

type Status = "pending" | "redirecting" | "show";

/**
 * When running inside the native Capacitor app (iOS/Android), redirects to /auth
 * and does not render children so the front page is never shown.
 * On web, renders children after the check.
 */
export default function CapacitorRedirectToAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    if (isNativeCapacitor()) {
      setStatus("redirecting");
      router.replace("/auth");
      return;
    }
    setStatus("show");
  }, [router]);

  if (status === "redirecting" || status === "pending") {
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
