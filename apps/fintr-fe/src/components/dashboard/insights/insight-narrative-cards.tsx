import Image from "next/image";
import Link from "next/link";
import { InsightCard } from "@/services/insights/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardSectionInsetClassName } from "@/components/dashboard/insights/dashboard-insights-surface";
import { profileImageForKey } from "@/lib/insights/profile-catalog";

interface InsightNarrativeCardsProps {
  insights: InsightCard[];
  isLoading?: boolean;
}

const severityStyles = {
  positive: {
    container: "bg-teal-500/10 dark:bg-teal-500/15",
    title: "text-teal-800 dark:text-teal-300",
    body: "text-teal-900/85 dark:text-teal-100/85",
    Icon: CheckCircle2,
  },
  neutral: {
    container: "bg-sky-500/10 dark:bg-sky-500/15",
    title: "text-sky-900 dark:text-sky-300",
    body: "text-sky-900/85 dark:text-sky-100/85",
    Icon: Info,
  },
  warning: {
    container: "bg-amber-500/10 dark:bg-amber-500/15",
    title: "text-amber-900 dark:text-amber-300",
    body: "text-amber-900/85 dark:text-amber-100/85",
    Icon: AlertTriangle,
  },
};

const InsightNarrativeCard = ({ insight }: { insight: InsightCard }) => {
  const styles = severityStyles[insight.severity];
  const Icon = styles.Icon;
  const imageSrc = insight.imageKey
    ? profileImageForKey(insight.imageKey)
    : null;

  if (imageSrc) {
    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-card",
        )}
      >
        <div className="relative aspect-[4/3] w-full bg-muted/40">
          <Image
            src={imageSrc}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 320px"
          />
        </div>
        <div className="flex flex-1 flex-col px-3 py-2.5">
          <h4
            className={cn(
              "text-xs font-semibold leading-snug text-primary",
            )}
          >
            {insight.title}
          </h4>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground line-clamp-3">
            {insight.body}
          </p>
          {insight.actionLabel && insight.actionHref && (
            <Link
              href={insight.actionHref}
              className="mt-1.5 inline-block text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              {insight.actionLabel}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 h-full border border-border/40",
        styles.container,
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", styles.title)} />
        <h4
          className={cn(
            "text-xs font-semibold leading-snug truncate",
            styles.title,
          )}
        >
          {insight.title}
        </h4>
      </div>
      <p className={cn("text-[12px] leading-snug line-clamp-2", styles.body)}>
        {insight.body}
      </p>
      {insight.actionLabel && insight.actionHref && (
        <Link
          href={insight.actionHref}
          className={cn(
            "mt-1.5 inline-block text-[11px] font-medium underline-offset-2 hover:underline",
            styles.title,
          )}
        >
          {insight.actionLabel}
        </Link>
      )}
    </div>
  );
};

export const InsightNarrativeCards = ({
  insights,
  isLoading = false,
}: InsightNarrativeCardsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((key) => (
          <div key={key} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!insights.length) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-insights-heading">
      <h2
        id="dashboard-insights-heading"
        className="mb-3 text-base font-semibold text-foreground"
      >
        Insights
      </h2>
      <div
        className={cn(
          dashboardSectionInsetClassName,
          "grid gap-3 p-3 sm:grid-cols-2",
        )}
      >
        {insights.map((insight) => (
          <InsightNarrativeCard
            key={`${insight.type}-${insight.profileKey ?? insight.title}`}
            insight={insight}
          />
        ))}
      </div>
    </section>
  );
};
