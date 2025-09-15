"use client";

import { useGetUsers, UserData } from "@/services/admin/user/queries";
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

import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useRef, Fragment, useState } from "react";
import { useInfiniteUsers } from "@/hooks/async/useInfiniteUsers";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function UsersPage() {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLTableRowElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");

  const {
    data,
    isFetching: isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
  } = useInfiniteUsers({
    loadMoreRef,
    searchQuery: appliedSearchQuery,
  }) as {
    data: {
      pages: { users: UserData[]; nextPage: number | undefined; totalCount?: number; }[];
      pageParams: (number | undefined)[];
    } | undefined;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  };

  // Get total count from the first page
  const totalCount = data?.pages[0]?.totalCount;



  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleSearch = () => {
    setAppliedSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearchQuery("");
  };

  const handleSearchBlur = () => {
    handleSearch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-destructive">Error loading users: {error?.message}</div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Users
          {totalCount !== undefined && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount} total)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-grow w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search Users"
              className="pl-10 bg-white"
              value={searchInput}
              onChange={handleSearchChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              onBlur={handleSearchBlur}
            />
          </div>
          <h3 className="text-lg font-medium mr-2">Users List</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.pages.map((page, i) => (
              <Fragment key={i}>
                {page.users.map((user: UserData) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {(isLoading || isFetchingNextPage) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            )}
            {!hasNextPage && !isLoading && data && data.pages.map((page: { users: UserData[]; nextPage: number | undefined }) => page.users.length).reduce((acc, length) => acc + length, 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            <TableRow ref={loadMoreRef} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
