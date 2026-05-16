import { Suspense } from "react";

import LoadingSpinner from "@/components/ui/loading-spinner";

import TicketDetailPage from "./ticket-detail-page";

export default function CrmSupportTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner size="medium" />
          </div>
        </div>
      }
    >
      <TicketDetailPage />
    </Suspense>
  );
}
