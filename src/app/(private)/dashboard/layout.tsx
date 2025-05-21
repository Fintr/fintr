import { TabsWrapper } from "@/components/tabs-wrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            My Goal to Financial Freedom
          </h1>
          <p className="text-primary/70">
            Having enough passive income to cover my expenses and being able to
            travel 3 months a year.
          </p>
        </div>
      </div>
      <div>
        <TabsWrapper>
          <TabsList className="w-full bg-white border">
            <TabsTrigger asChild value="transactions">
              <Link prefetch href="/dashboard/">Transactions</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="budgets">
              <Link prefetch href="/dashboard/budgets">Budgets</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="goals">
              <Link prefetch href="/dashboard/goals">Goals</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="investments">
              <Link prefetch href="/dashboard/investments">Investments</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="insights">
              <Link prefetch href="/dashboard/insights">Insights</Link>
            </TabsTrigger>
            <TabsTrigger asChild value="database">
              <Link prefetch href="/dashboard/database">Database</Link>
            </TabsTrigger>
          </TabsList>
          {children}
        </TabsWrapper>
      </div>
    </div>
  );
}
