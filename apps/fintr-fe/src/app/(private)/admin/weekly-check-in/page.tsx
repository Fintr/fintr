"use client";

import type { DateRange } from "@daypicker/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import {
  fetchAdminProductPulseFeedbacks,
  type ProductPulseFeedbackRow,
} from "@/services/admin/product-pulse-feedbacks";
import { feedbackAreaLabel } from "@/config/weekly-feedback";
import { formatDistanceToNow } from "date-fns";

const formatAreaInline = (ids: string[]) =>
  ids.length === 0 ? "—" : ids.map(feedbackAreaLabel).join(", ");

const AreaList = ({ ids }: { ids: string[] }) =>
  ids.length === 0 ? (
    <span className="text-primary/50">—</span>
  ) : (
    <ul className="list-disc space-y-1 pl-4 text-left break-words">
      {ids.map((id) => (
        <li key={id} className="text-sm">
          <span className="font-mono text-xs text-primary/50">{id}</span>
          {" · "}
          {feedbackAreaLabel(id)}
        </li>
      ))}
    </ul>
  );

export default function AdminWeeklyCheckInPage() {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const [rows, setRows] = useState<ProductPulseFeedbackRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [spaceName, setSpaceName] = useState("");
  const debouncedSpaceName = useDebouncedValue(spaceName, SEARCH_DEBOUNCE_MS);
  const [submissionDateMode, setSubmissionDateMode] = useState<"any" | "range">("any");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ProductPulseFeedbackRow | null>(null);

  const filterStartDate = useMemo(() => {
    if (submissionDateMode !== "range" || !dateRange?.from) return "";
    return format(dateRange.from, "yyyy-MM-dd");
  }, [dateRange, submissionDateMode]);

  const filterEndDate = useMemo(() => {
    if (submissionDateMode !== "range" || !dateRange?.from) return "";
    if (dateRange.to) return format(dateRange.to, "yyyy-MM-dd");
    return format(dateRange.from, "yyyy-MM-dd");
  }, [dateRange, submissionDateMode]);

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range) {
      const updatedRange: DateRange = {
        from: range.from,
        to: range.to,
      };
      const hadIncompleteSelection = dateRange?.from != null && dateRange?.to == null;
      const nowComplete = updatedRange.from != null && updatedRange.to != null;

      setDateRange(updatedRange);

      if (hadIncompleteSelection && nowComplete) {
        setDateRangePickerOpen(false);
      }
    } else {
      setDateRange(undefined);
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminProductPulseFeedbacks(api, {
        spaceName: debouncedSpaceName.trim() || undefined,
        startDate: filterStartDate.trim() || undefined,
        endDate: filterEndDate.trim() || undefined,
        page,
        perPage: 25,
      });
      setRows(res.data.productPulseFeedbacks);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.totalCount);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [api, debouncedSpaceName, filterEndDate, filterStartDate, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSpaceName, filterEndDate, filterStartDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold lg:text-3xl">Weekly check in</h1>
      <p className="text-primary/70 max-w-2xl">
        Weekly in-app feedback from users (separate from support tickets). Open a row to see every
        selection and raw area ids. Filter by space name (partial match), or use Submitted → Date
        range to pick start and end dates with the same range picker used on Insights and Budgets.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-1">
            <Label htmlFor="weekly-check-in-space-name">Space name</Label>
            <Input
              id="weekly-check-in-space-name"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="Partial name, e.g. Acme"
              className="md:w-72"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <Label htmlFor="weekly-check-in-submitted">Submitted</Label>
            <Select
              value={submissionDateMode}
              onValueChange={(value) => {
                const mode = value as "any" | "range";
                setSubmissionDateMode(mode);
                if (mode === "any") {
                  setDateRange(undefined);
                  setDateRangePickerOpen(false);
                }
              }}
            >
              <SelectTrigger id="weekly-check-in-submitted" className="w-full md:w-[200px]">
                <SelectValue placeholder="Submitted" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="range">Date range…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {submissionDateMode === "range" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1 min-w-0">
                <Label>Range</Label>
                <DateRangePicker
                  open={dateRangePickerOpen}
                  onOpenChange={setDateRangePickerOpen}
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full min-w-0 justify-start text-left font-normal text-sm sm:w-[min(100%,280px)]"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM d, yyyy")} —{" "}
                              {format(dateRange.to, "MMM d, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          "Pick a date range"
                        )}
                      </span>
                    </Button>
                  }
                />
              </div>
              {dateRange?.from ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start sm:self-end"
                  onClick={() => {
                    setDateRange(undefined);
                  }}
                >
                  Clear range
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Apply
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Submissions ({totalCount})</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead className="min-w-[200px]">User</TableHead>
                    <TableHead className="whitespace-nowrap">Week</TableHead>
                    <TableHead className="min-w-[220px]">What&apos;s working</TableHead>
                    <TableHead className="min-w-[220px]">Needs improvement</TableHead>
                    <TableHead className="min-w-[120px]">Notes</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap align-top text-sm">
                        {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="max-w-[min(24rem,40vw)] align-top text-sm break-words">
                        {row.user?.email ?? row.user?.fullName ?? row.user?.id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">{row.periodKey}</TableCell>
                      <TableCell className="max-w-[min(28rem,50vw)] align-top text-sm">
                        <div className="break-words">{formatAreaInline(row.likedAreas)}</div>
                        {row.likedAreas.length > 1 ? (
                          <p className="mt-1 text-xs text-primary/50">
                            {row.likedAreas.length} selections — use View for the full list
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[min(28rem,50vw)] align-top text-sm">
                        <div className="break-words">{formatAreaInline(row.improveAreas)}</div>
                        {row.improveAreas.length > 1 ? (
                          <p className="mt-1 text-xs text-primary/50">
                            {row.improveAreas.length} selections — use View for the full list
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-pre-wrap align-top break-words text-sm">
                        {row.notes?.trim() ? row.notes : "—"}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => setDetailRow(row)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-primary/60">No submissions yet.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailRow != null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Weekly check in — full answers</DialogTitle>
            <DialogDescription>
              {detailRow
                ? [
                    detailRow.user?.email ?? detailRow.user?.fullName ?? "User",
                    detailRow.space?.name ?? detailRow.space?.code,
                    detailRow.periodKey,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-6 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">What&apos;s working</p>
                <AreaList ids={detailRow.likedAreas} />
                <p className="mt-2 text-xs text-primary/50">
                  {detailRow.likedAreas.length} area{detailRow.likedAreas.length === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                  Needs improvement
                </p>
                <AreaList ids={detailRow.improveAreas} />
                <p className="mt-2 text-xs text-primary/50">
                  {detailRow.improveAreas.length} area{detailRow.improveAreas.length === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Notes</p>
                <p className="whitespace-pre-wrap break-words text-primary">
                  {detailRow.notes?.trim() ? detailRow.notes : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Raw payload (debug)</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(
                    {
                      id: detailRow.id,
                      periodKey: detailRow.periodKey,
                      space: detailRow.space,
                      likedAreas: detailRow.likedAreas,
                      improveAreas: detailRow.improveAreas,
                      notes: detailRow.notes,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
