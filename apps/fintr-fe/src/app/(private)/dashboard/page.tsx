"use client";
import { Suspense } from "react";
import { TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/ui/loading-spinner";

const DynamicTransactionsTab = dynamic(
  () => import("@/components/dashboard/tabs/transactions/index"),
  {
    ssr: false,
  }
);

export default function page() {
  return (
    <TabsContent value="transactions">
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <LoadingSpinner size="medium" />
          </div>
        }
      >
        <DynamicTransactionsTab />
      </Suspense>
    </TabsContent>
  );
}
