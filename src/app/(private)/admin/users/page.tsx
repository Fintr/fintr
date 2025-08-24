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
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWhitelist, deleteWhitelist } from "@/services/admin/whitelist/mutations";
import { WhitelistEntry, CreateWhitelistPayload, DeleteWhitelistPayload } from "@/types/adminTypes";
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
      pages: { users: UserData[]; nextPage: number | undefined; }[];
      pageParams: (number | undefined)[];
    } | undefined;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  };

  const { mutate: whitelistUser, isLoading: isWhitelisting } = useMutation<WhitelistEntry, Error, string>({
    mutationFn: (email) => createWhitelist(api, { email }),
    onSuccess: (newWhitelistEntry) => {
      console.log("Whitelisting successful. New entry:", newWhitelistEntry);
      queryClient.setQueryData(["admin", "users", appliedSearchQuery], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: {
            users: UserData[];
            nextPage: number | undefined;
          }) => ({
            ...page,
            users: page.users.map((user: UserData) => {
              if (user.email === newWhitelistEntry.email) {
                console.log("Updating user whitelistId for:", user.email, "from", user.whitelistId, "to", newWhitelistEntry.id);
                return { ...user, whitelistId: newWhitelistEntry.id };
              }
              return user;
            }),
          })),
        };
      });
      toast.success("User whitelisted successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin", "whitelists"], refetchType: 'active' });
    },
  });
  const { mutate: removeWhitelistUser, isLoading: isRemovingWhitelist } = useMutation<void, Error, string>({
    mutationFn: (id) => deleteWhitelist(api, { id }),
    onSuccess: (data, removedWhitelistId) => {
      console.log("Removing whitelist successful. Removed ID:", removedWhitelistId);
      queryClient.setQueryData(["admin", "users", appliedSearchQuery], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: {
            users: UserData[];
            nextPage: number | undefined;
          }) => ({
            ...page,
            users: page.users.map((user: UserData) => {
              if (user.whitelistId === removedWhitelistId) {
                console.log("Updating user whitelistId for:", user.email, "from", user.whitelistId, "to null");
                return { ...user, whitelistId: null };
              }
              return user;
            }),
          })),
        };
      });
      toast.success("User removed from whitelist successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin", "whitelists"], refetchType: 'active' });
    },
  });

  const handleWhitelistToggle = (user: UserData) => {
    if (user.whitelistId) {
      removeWhitelistUser(user.whitelistId, {
        onSuccess: () => {
          toast.success("User removed from whitelist successfully.");
        },
        onError: (err) => {
          toast.error(`Failed to remove user from whitelist: ${err.message}`);
        },
      });
    } else {
      whitelistUser(user.email, {
        onSuccess: () => {
          toast.success("User whitelisted successfully.");
        },
        onError: (err) => {
          toast.error(`Failed to whitelist user: ${err.message}`);
        },
      });
    }
  };

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
        <CardTitle>Users</CardTitle>
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
              <TableHead>Whitelisted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.pages.map((page, i) => (
              <Fragment key={i}>
                {page.users.map((user: UserData) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.whitelistId ? (
                        <CheckCircle className="h-5 w-5 text-teal-100/500" />
                      ) : (
                        <XCircle className="h-5 w-5 bg-red-800" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={user.whitelistId ? "destructive" : "default"}
                        onClick={() => handleWhitelistToggle(user)}
                        disabled={isWhitelisting || isRemovingWhitelist}
                      >
                        {user.whitelistId ? "Remove Whitelist" : "Whitelist User"}
                      </Button>
                    </TableCell>
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
            <tr ref={loadMoreRef} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
