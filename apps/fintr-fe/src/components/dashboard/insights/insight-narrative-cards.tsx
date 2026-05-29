import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/services/insights/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface InsightNarrativeCardsProps {
  insights: InsightCard[];
  isLoading?: boolean;
}

const severityStyles = {
  positive: {
    container: "border-0 bg-teal-50 dark:bg-teal-950/50",
    icon: "bg-teal-600 dark:bg-teal-500",
    title: "text-green-800 dark:text-teal-200",
    body: "text-green-700 dark:text-teal-500/90",
    Icon: CheckCircle2,
  },
  neutral: {
    container: "border-0 bg-primary/5 dark:bg-muted",
    icon: "bg-primary dark:bg-primary",
    title: "text-primary",
    body: "text-primary/70",
    Icon: Info,
  },
  warning: {
    container: "border-0 bg-amber-50 dark:bg-amber-950/50",
    icon: "bg-amber-600 dark:bg-amber-500",
    title: "text-amber-900 dark:text-amber-200",
    body: "text-amber-800 dark:text-amber-300/90",
    Icon: AlertTriangle,
  },
};

export const InsightNarrativeCards = ({
  insights,
  isLoading = false,
}: InsightNarrativeCardsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((key) => (
          <div key={key} className="h-24 rounded-lg bg-gray-100 dark:bg-muted" />
        ))}
      </div>
    );
  }

  if (!insights.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {insights.map((insight) => {
        const styles = severityStyles[insight.severity];
        const Icon = styles.Icon;

        return (
          <div
            key={`${insight.type}-${insight.title}`}
            className={`rounded-lg p-4 shadow-sm ${styles.container}`}
          >
            <div className="flex items-start gap-3">
              <div className={`text-white p-2 rounded-full ${styles.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium mb-1 ${styles.title}`}>
                  {insight.title}
                </h4>
                <p className={`text-sm ${styles.body}`}>{insight.body}</p>
                {insight.actionLabel && insight.actionHref && (
                  <div className="mt-3">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-0 bg-white shadow-xs dark:bg-card dark:hover:bg-accent/50"
                    >
                      <Link href={insight.actionHref}>
                        {insight.actionLabel}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
