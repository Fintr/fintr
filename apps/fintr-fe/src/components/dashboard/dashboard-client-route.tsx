"use client";

import type { ComponentType, ReactNode } from "react";

import {
  resolveDashboardClientRouteKey,
  type DashboardClientRouteKey,
} from "@/lib/dashboard-nav-routes";

import AccountDetailPage from "@/app/(private)/dashboard/space_settings/accounts/detail/page";
import AccountsPage from "@/app/(private)/dashboard/space_settings/accounts/page";
import CategoriesPage from "@/app/(private)/dashboard/space_settings/categories/page";
import CategoryDetailPage from "@/app/(private)/dashboard/space_settings/categories/detail/page";
import EntitiesPage from "@/app/(private)/dashboard/space_settings/entities/page";
import EntityDetailPage from "@/app/(private)/dashboard/space_settings/entities/detail/page";
import GoalsPage from "@/app/(private)/dashboard/goals/page";
import ImportPage from "@/app/(private)/dashboard/space_settings/import/page";
import InvestmentsPage from "@/app/(private)/dashboard/investments/page";
import LoanDetailPage from "@/app/(private)/dashboard/loans/detail/page";
import RecurringDetailPage from "@/app/(private)/dashboard/recurring/detail/page";
import SettingsPage from "@/app/(private)/dashboard/settings/page";
import SpaceSubscriptionsPage from "@/app/(private)/dashboard/space_settings/subscriptions/page";
import SubscriptionsPage from "@/app/(private)/dashboard/subscriptions/page";
import TagsPage from "@/app/(private)/dashboard/space_settings/tags/page";
import TransactionDetailPage from "@/app/(private)/dashboard/transactions/detail/page";

const DASHBOARD_CLIENT_PAGES: Record<
  DashboardClientRouteKey,
  ComponentType
> = {
  loan_detail: LoanDetailPage,
  transaction_detail: TransactionDetailPage,
  recurring_detail: RecurringDetailPage,
  account_detail: AccountDetailPage,
  entity_detail: EntityDetailPage,
  category_detail: CategoryDetailPage,
  accounts: AccountsPage,
  entities: EntitiesPage,
  categories: CategoriesPage,
  tags: TagsPage,
  import: ImportPage,
  space_subscriptions: SpaceSubscriptionsPage,
  settings: SettingsPage,
  goals: GoalsPage,
  investments: InvestmentsPage,
  subscriptions: SubscriptionsPage,
};

export function DashboardClientRoute({
  pathname,
  fallback,
}: {
  pathname: string;
  fallback: ReactNode;
}) {
  const routeKey = resolveDashboardClientRouteKey(pathname);
  if (!routeKey) {
    return fallback;
  }

  const Page = DASHBOARD_CLIENT_PAGES[routeKey];
  return <Page />;
}
