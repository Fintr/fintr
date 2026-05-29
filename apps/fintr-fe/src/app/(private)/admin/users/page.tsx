"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAdminUsers } from "@/hooks/async/useAdminUsers";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Search } from "lucide-react";
import { UserData } from "@/services/admin/user/queries";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";

const PER_PAGE = 25;

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchInput = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [searchForApi, setSearchForApi] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const safePage = Math.max(
    1,
    parseInt(String(currentPage), 10) || 1,
  );

  const setSafePage = (page: number | ((prev: number) => number)) => {
    if (typeof page === "function") {
      setCurrentPage((prev) => {
        const next = page(prev);
        return Math.max(1, parseInt(String(next), 10) || 1);
      });
    } else {
      setCurrentPage(Math.max(1, parseInt(String(page), 10) || 1));
    }
  };

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useAdminUsers({
    page: safePage,
    perPage: PER_PAGE,
    searchQuery: searchForApi,
  });

  useEffect(() => {
    const next = debouncedSearchInput.trim();
    setSearchForApi((prev) => (prev === next ? prev : next));
  }, [debouncedSearchInput]);

  useEffect(() => {
    setSafePage(1);
  }, [debouncedSearchInput]);

  const pagination = data?.pagination;
  const users = data?.users ?? [];
  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.totalCount ?? 0;

  const applySearch = () => {
    setSearchForApi(searchInput.trim());
    setSafePage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchForApi("");
    setSafePage(1);
  };

  const initialLoad = isLoading && !data;

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-destructive">
        Error loading users: {error?.message}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>
          Users
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({totalCount} total)
          </span>
        </CardTitle>
        {isFetching && !initialLoad ? (
          <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <LoadingSpinner size="small" className="!justify-start" />
            Updating…
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-6">
          <div className="space-y-2 max-w-xl">
            <Label htmlFor="admin-users-search">Search by email or name</Label>
            <SearchField
              id="admin-users-search"
              placeholder="Email or full name"
              iconClassName="text-muted-foreground"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch();
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={applySearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button type="button" variant="outline" onClick={clearSearch}>
              Clear
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full name</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No users match this search.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: UserData) => (
                <TableRow key={user.id}>
                  <TableCell className="min-w-[120px]">
                    {user.fullName?.trim() || user.email || "—"}
                  </TableCell>
                  <TableCell className="min-w-0 break-all">
                    {user.email || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalCount > 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
            <div className="text-sm text-muted-foreground">
              Page {pagination?.currentPage ?? safePage} of {totalPages} ({totalCount} users)
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(1)}
                  disabled={safePage === 1}
                  className="hidden sm:flex"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1 mx-2">
                  {(() => {
                    const current = safePage;
                    const pages: ReactNode[] = [];
                    if (current > 3) {
                      pages.push(
                        <Button
                          key={1}
                          variant={1 === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(1)}
                          className="w-8 h-8 p-0"
                        >
                          1
                        </Button>,
                      );
                      if (current > 4) {
                        pages.push(
                          <span key="ellipsis1" className="px-2 text-muted-foreground">
                            …
                          </span>,
                        );
                      }
                    }
                    const start = Math.max(1, current - 1);
                    const end = Math.min(totalPages, current + 1);
                    for (let i = start; i <= end; i += 1) {
                      pages.push(
                        <Button
                          key={i}
                          variant={i === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(i)}
                          className="w-8 h-8 p-0"
                        >
                          {i}
                        </Button>,
                      );
                    }
                    if (current < totalPages - 2) {
                      if (current < totalPages - 3) {
                        pages.push(
                          <span key="ellipsis2" className="px-2 text-muted-foreground">
                            …
                          </span>,
                        );
                      }
                      pages.push(
                        <Button
                          key={totalPages}
                          variant={totalPages === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(totalPages)}
                          className="w-8 h-8 p-0"
                        >
                          {totalPages}
                        </Button>,
                      );
                    }
                    return pages;
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(totalPages)}
                  disabled={safePage >= totalPages}
                  className="hidden sm:flex"
                >
                  Last
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
