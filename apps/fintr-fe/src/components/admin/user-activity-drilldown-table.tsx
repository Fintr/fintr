"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { UserActivityDrilldownRow } from "@/services/admin/analytics/queries";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortableKey =
  | "fullName"
  | "email"
  | "apiRequestCount"
  | "dashboardViewedCount"
  | "totalRequests"
  | "transactionsCreated"
  | "standaloneTransactions"
  | "transferLegTransactions"
  | "transfersCreated"
  | "receiptScans"
  | "aiChatUsages"
  | "aiInteractions";

export interface UserActivityDrilldownTableProps {
  rows: UserActivityDrilldownRow[];
  averageRow?: UserActivityDrilldownRow | null;
}

function compareRows(
  a: UserActivityDrilldownRow,
  b: UserActivityDrilldownRow,
  key: SortableKey,
  dir: "asc" | "desc"
): number {
  const va = a[key];
  const vb = b[key];
  if (typeof va === "string" && typeof vb === "string") {
    const cmp = va.localeCompare(vb);
    return dir === "asc" ? cmp : -cmp;
  }
  const na = Number(va);
  const nb = Number(vb);
  const cmp = na === nb ? 0 : na < nb ? -1 : 1;
  return dir === "asc" ? cmp : -cmp;
}

function formatMetric(value: number, variant: "user" | "average"): string {
  if (variant === "user") {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

export function UserActivityDrilldownTable({
  rows,
  averageRow = null,
}: UserActivityDrilldownTableProps) {
  const [sortKey, setSortKey] = useState<SortableKey>("totalRequests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const copyEmail = async (email: string) => {
    try {
      if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
        toast.error("Clipboard is not available in this browser.");
        return;
      }
      await navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard.");
    } catch {
      toast.error("Could not copy email.");
    }
  };

  const sortedUsers = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortableKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "fullName" || key === "email" ? "asc" : "desc");
    }
  };

  const head = (key: SortableKey, label: string, opts?: { stickyName?: boolean }) => (
    <TableHead
      className={cn(
        opts?.stickyName
          ? "sticky left-0 top-0 z-30 min-w-[10rem] max-w-[14rem] border-b border-r border-border bg-muted py-3"
          : "sticky top-0 z-20 whitespace-nowrap border-b border-border bg-muted py-3"
      )}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        onClick={() => toggleSort(key)}
      >
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </TableHead>
  );

  const metricCellClass = (isAverage: boolean) =>
    cn(
      "whitespace-nowrap py-3 tabular-nums",
      isAverage ? "bg-muted group-hover:bg-muted" : "bg-background group-hover:bg-muted"
    );

  const nameCellClass = (isAverage: boolean) =>
    cn(
      "sticky left-0 z-20 min-w-[10rem] max-w-[14rem] border-r border-border py-3",
      isAverage
        ? "bg-muted font-medium shadow-[2px_0_6px_-3px_rgba(0,0,0,0.12)] group-hover:bg-muted"
        : "bg-background font-medium shadow-[2px_0_6px_-3px_rgba(0,0,0,0.12)] group-hover:bg-muted"
    );

  const emailCellClass = (isAverage: boolean) =>
    cn(
      "py-3",
      isAverage ? "bg-muted group-hover:bg-muted" : "bg-background group-hover:bg-muted"
    );

  const renderMetricCells = (row: UserActivityDrilldownRow, variant: "user" | "average") => (
    <>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.apiRequestCount, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.dashboardViewedCount, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.totalRequests, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.transactionsCreated, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.standaloneTransactions, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.transferLegTransactions, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.transfersCreated, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.receiptScans, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.aiChatUsages, variant)}
      </TableCell>
      <TableCell className={cn(metricCellClass(variant === "average"))}>
        {formatMetric(row.aiInteractions, variant)}
      </TableCell>
    </>
  );

  if (rows.length === 0 && !averageRow) {
    return (
      <p className="text-sm text-muted-foreground">
        No active users for this date. Active users are accounts with authenticated API activity that
        day (not necessarily a password login).
      </p>
    );
  }

  return (
    <div
      className={cn(
        "relative max-h-[min(70vh,36rem)] w-full overflow-auto rounded-md border bg-background",
        "shadow-sm"
      )}
    >
      <table className="w-full min-w-max border-separate border-spacing-0 caption-bottom text-sm">
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent">
            {head("fullName", "Name", { stickyName: true })}
            {head("email", "Email")}
            {head("apiRequestCount", "API requests")}
            {head("dashboardViewedCount", "Dashboard views")}
            {head("totalRequests", "Total requests")}
            {head("transactionsCreated", "Transactions")}
            {head("standaloneTransactions", "Standalone tx")}
            {head("transferLegTransactions", "Transfer legs")}
            {head("transfersCreated", "Transfers")}
            {head("receiptScans", "Receipt scans")}
            {head("aiChatUsages", "AI chat (usage)")}
            {head("aiInteractions", "AI interactions")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {averageRow ? (
            <TableRow
              key="average"
              className="group border-b border-border text-muted-foreground hover:bg-muted"
            >
              <TableCell className={nameCellClass(true)}>
                <span className="line-clamp-2 break-words text-foreground">{averageRow.fullName}</span>
              </TableCell>
              <TableCell className={emailCellClass(true)}>
                <span className="truncate text-muted-foreground">{averageRow.email}</span>
              </TableCell>
              {renderMetricCells(averageRow, "average")}
            </TableRow>
          ) : null}
          {sortedUsers.map((row) => (
            <TableRow key={row.id} className="group border-b border-border hover:bg-muted">
              <TableCell className={nameCellClass(false)}>
                <span className="line-clamp-2 break-words">{row.fullName}</span>
              </TableCell>
              <TableCell className={cn(emailCellClass(false), "whitespace-nowrap")}>
                <div className="flex min-w-0 max-w-[16rem] items-center gap-2">
                  <span className="truncate">{row.email}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void copyEmail(row.email)}
                    aria-label={`Copy email ${row.email}`}
                    title="Copy email"
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </TableCell>
              {renderMetricCells(row, "user")}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
