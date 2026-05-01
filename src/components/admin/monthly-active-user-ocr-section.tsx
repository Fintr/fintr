"use client";

import type {
  MonthlyActiveUserOcrMeta,
  MonthlyActiveUserOcrRow,
  OcrActiveUserSummary,
} from "@/services/admin/analytics/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingUp } from "lucide-react";

export interface MonthlyActiveUserOcrSectionProps {
  monthlyRows: MonthlyActiveUserOcrRow[];
  meta: MonthlyActiveUserOcrMeta;
  summary: OcrActiveUserSummary;
  onMonthlyOcrPageChange: (page: number) => void;
  isMonthlyOcrPageLoading?: boolean;
}

export function MonthlyActiveUserOcrSection({
  monthlyRows,
  meta,
  summary,
  onMonthlyOcrPageChange,
  isMonthlyOcrPageLoading = false,
}: MonthlyActiveUserOcrSectionProps) {
  const canPrev = meta.page > 1;
  const canNext = meta.totalPages > 0 && meta.page < meta.totalPages;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Monthly OCR (active users)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          An <span className="font-medium text-foreground">active user</span> for a calendar month is anyone
          with authenticated app activity on at least {summary.minActiveDaysRequired} distinct days that
          month. OCR totals are <span className="font-mono text-xs">pure_ai_ocr</span> token usage in that
          month, only for those active users. The headline average is the mean of the monthly
          per-active-user averages, counting only months with at least one qualifying user.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Avg monthly OCR / active user
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {summary.monthsWithActiveUsers > 0
                ? summary.averageMonthlyOcrAcrossMonths.toFixed(2)
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Mean of monthly per-user averages</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Months in range</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.monthsInRange}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Months with active users</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.monthsWithActiveUsers}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Min active days / month</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.minActiveDaysRequired}</p>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right tabular-nums">Active users</TableHead>
                <TableHead className="text-right tabular-nums">Total OCR tokens</TableHead>
                <TableHead className="text-right tabular-nums">Avg OCR / active user</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.monthLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.activeUserCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalOcrTokens}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeUserCount > 0 ? row.averageOcrTokensPerActiveUser.toFixed(2) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {meta.totalCount > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {monthlyRows.length} of {meta.totalCount} months
              {meta.totalPages > 1
                ? ` (page ${meta.page} of ${meta.totalPages}). Summary cards use the full date range.`
                : "."}
            </p>
            {meta.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canPrev || isMonthlyOcrPageLoading}
                  onClick={() => onMonthlyOcrPageChange(meta.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canNext || isMonthlyOcrPageLoading}
                  onClick={() => onMonthlyOcrPageChange(meta.page + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
