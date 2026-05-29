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
    container: "border-0 bg-teal-50",
    icon: "bg-teal-600",
    title: "text-green-800",
    body: "text-green-700",
    Icon: CheckCircle2,
  },
  neutral: {
    container: "border-0 bg-primary/5",
    icon: "bg-primary",
    title: "text-primary",
    body: "text-primary/70",
    Icon: Info,
  },
  warning: {
    container: "border-0 bg-amber-50",
    icon: "bg-amber-600",
    title: "text-amber-900",
    body: "text-amber-800",
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
          <div key={key} className="h-24 rounded-lg bg-gray-100" />
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
                      className="text-xs h-8"
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
