"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useProAccess } from "@/hooks/async/useProAccess";

export function ProRequiredNotice({ featureName }: { featureName: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
      <p className="font-medium text-foreground">
        Fintr Pro is required for {featureName}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        New accounts include a 7-day trial. After that, get Fintr Pro in Settings.
      </p>
      <Button variant="link" className="mt-1 h-auto p-0" asChild>
        <Link href="/dashboard/settings">Get Fintr Pro</Link>
      </Button>
    </div>
  );
}

export function ProFeatureGate({
  featureName,
  children,
}: {
  featureName: string;
  children: React.ReactNode;
}) {
  const { data, isPending, isPaused } = useProAccess();

  if (!data) {
    if (isPending && !isPaused) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Checking Fintr Pro…
        </p>
      );
    }

    return <ProRequiredNotice featureName={featureName} />;
  }

  if (data.pro) {
    return <>{children}</>;
  }

  return <ProRequiredNotice featureName={featureName} />;
}
