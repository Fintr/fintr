"use client";

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSpaceUsers } from "@/hooks/async/useSpaceUsers";
import { useSpacePermissions } from "@/hooks/useSpacePermissions";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { Users, UserPlus, Trash2, Mail, Shield, User, Edit2, Save, X, Info } from "lucide-react";
import { SpaceUser } from "@/types/spaceTypes";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { spacesApi } from "@/services/spaces/api";
import { toast } from "sonner";
import { currentSpaceAtom, availableSpacesAtom } from "@/atoms/spaceAtoms";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CURRENCY_CODES } from "@/data/currencies";

const SpaceAccessCard = () => {
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const { canManageUsers } = useSpacePermissions();
  const queryClient = useQueryClient();
  const setCurrentSpace = useSetAtom(currentSpaceAtom);
  const setAvailableSpaces = useSetAtom(availableSpacesAtom);
  const {
    users,
    isLoading,
    isError,
    grantAccess,
    removeUser,
    isGrantingAccess,
    isRemovingUser,
  } = useSpaceUsers();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingSpaceName, setIsEditingSpaceName] = useState(false);
  const [spaceName, setSpaceName] = useState(currentSpace?.name || "");
  const [spaceCurrency, setSpaceCurrency] = useState(
    currentSpace?.currency ?? "PHP"
  );
  const defaultTransactionCurrency =
    currentSpace?.defaultTransactionCurrency ?? currentSpace?.currency ?? "";
  const [defaultCurrency, setDefaultCurrency] = useState(defaultTransactionCurrency);
  const [isSavingCurrencies, setIsSavingCurrencies] = useState(false);

  // Update space mutation (name, currency, and/or default transaction currency)
  const updateSpaceMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      currency?: string | null;
      defaultTransactionCurrency?: string | null;
    }) => {
      if (!currentSpace?.id) throw new Error("No space selected");
      const response = await spacesApi.updateSpace(api, currentSpace.id, {
        name: params.name,
        ...(params.currency !== undefined && {
          currency: params.currency,
        }),
        ...(params.defaultTransactionCurrency !== undefined && {
          defaultTransactionCurrency: params.defaultTransactionCurrency,
        }),
      });
      return response.data.data.space;
    },
    onSuccess: (updatedSpace) => {
      toast.success("Space updated successfully");
      setIsEditingSpaceName(false);
      setSpaceName(updatedSpace.name);
      setSpaceCurrency(updatedSpace.currency ?? "PHP");
      setDefaultCurrency(
        updatedSpace.defaultTransactionCurrency ?? updatedSpace.currency ?? ""
      );

      // Update atoms immediately for instant UI update
      if (currentSpace?.id === updatedSpace.id) {
        setCurrentSpace(updatedSpace);
      }

      // Update the space in availableSpacesAtom
      setAvailableSpaces((prevSpaces) =>
        prevSpaces.map((space) =>
          space.id === updatedSpace.id ? updatedSpace : space
        )
      );

      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({
        queryKey: ["space-context", currentSpace?.code],
      });
      queryClient.invalidateQueries({ queryKey: ["space-context"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update space name");
    },
  });

  const handleUpdateSpaceName = async () => {
    if (!spaceName.trim()) {
      toast.error("Space name cannot be empty");
      return;
    }
    await updateSpaceMutation.mutateAsync({
      name: spaceName.trim(),
    });
  };

  const spaceCurrencyChanged =
    spaceCurrency !== (currentSpace?.currency ?? "PHP");
  const defaultCurrencyChanged =
    defaultCurrency !==
    (currentSpace?.defaultTransactionCurrency ?? currentSpace?.currency ?? "");
  const hasCurrencyChanges = spaceCurrencyChanged || defaultCurrencyChanged;

  const handleSaveCurrencies = async () => {
    if (!currentSpace?.name || !hasCurrencyChanges) return;
    const spaceCurrencyValue =
      spaceCurrency && CURRENCY_CODES.has(spaceCurrency.toUpperCase())
        ? spaceCurrency.toUpperCase()
        : currentSpace?.currency ?? "PHP";
    const defaultCurrencyValue =
      defaultCurrency && CURRENCY_CODES.has(defaultCurrency.toUpperCase())
        ? defaultCurrency.toUpperCase()
        : null;
    setIsSavingCurrencies(true);
    try {
      await updateSpaceMutation.mutateAsync({
        name: currentSpace.name,
        currency: spaceCurrencyValue,
        defaultTransactionCurrency: defaultCurrencyValue,
      });
    } finally {
      setIsSavingCurrencies(false);
    }
  };

  const handleCancelEdit = () => {
    setSpaceName(currentSpace?.name || "");
    setIsEditingSpaceName(false);
  };

  // Update spaceName, spaceCurrency, and defaultCurrency when currentSpace changes
  useEffect(() => {
    if (currentSpace?.name && !isEditingSpaceName) {
      setSpaceName(currentSpace.name);
    }
    if (currentSpace) {
      setSpaceCurrency(currentSpace.currency ?? "PHP");
      setDefaultCurrency(
        currentSpace.defaultTransactionCurrency ?? currentSpace.currency ?? ""
      );
    }
  }, [
    currentSpace?.name,
    currentSpace?.currency,
    currentSpace?.defaultTransactionCurrency,
    isEditingSpaceName,
    currentSpace,
  ]);

  const handleGrantAccess = async () => {
    if (!email.trim()) return;

    await grantAccess({ email: email.trim(), role });
    setEmail("");
    setRole("member");
    setShowAddForm(false);
  };

  const handleRemoveUser = async (userId: string) => {
    await removeUser(userId);
  };

  const getRoleIcon = (userRole: string) => {
    return userRole === "admin" ? (
      <Shield className="h-4 w-4 text-blue-600" />
    ) : (
      <User className="h-4 w-4 text-gray-600" />
    );
  };

  const getRoleBadgeVariant = (userRole: string) => {
    return userRole === "admin" ? "default" : "secondary";
  };

  if (!canManageUsers) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Space Access Management
        </CardTitle>
        <CardDescription>
          Manage who has access to this space and their permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Space Name */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Space name</h4>
            {!isEditingSpaceName ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                onClick={() => setIsEditingSpaceName(true)}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
          {isEditingSpaceName ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                id="space-name"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="Enter space name"
                className="h-9 flex-1 min-w-[160px]"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-9"
                  onClick={handleUpdateSpaceName}
                  disabled={!spaceName.trim() || updateSpaceMutation.isPending}
                >
                  {updateSpaceMutation.isPending ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={handleCancelEdit}
                  disabled={updateSpaceMutation.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {currentSpace?.name || "Loading..."}
            </p>
          )}
        </div>

        {/* Currency (space + default for expenses/income) */}
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Currency</h4>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleSaveCurrencies}
              disabled={
                !hasCurrencyChanges ||
                isSavingCurrencies ||
                updateSpaceMutation.isPending
              }
            >
              {isSavingCurrencies || updateSpaceMutation.isPending ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save changes
                </>
              )}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Space currency
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="More information"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <p className="text-sm text-muted-foreground">
                      Main currency for this space. Used for totals and reports.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <CurrencyPicker
                value={spaceCurrency}
                onChange={setSpaceCurrency}
                label=""
                placeholder="Search..."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Default for expenses & income
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="More information"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <p className="text-sm text-muted-foreground">
                      Pre-selected when adding an expense or income.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <CurrencyPicker
                value={defaultCurrency}
                onChange={setDefaultCurrency}
                label=""
                placeholder="Search..."
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Add User Form */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Grant access</h4>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {showAddForm ? "Cancel" : "Add user"}
            </Button>
          </div>

          {showAddForm && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(value: "admin" | "member") => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGrantAccess}
                  disabled={!email.trim() || isGrantingAccess}
                  size="sm"
                >
                  {isGrantingAccess ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Grant Access
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEmail("");
                    setRole("member");
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Current Users</h4>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="medium" />
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-500">
              Failed to load users
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No users have access to this space
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user: SpaceUser) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm break-words">
                          {user.fullName?.trim() || user.email || "—"}
                        </div>
                        <div className="text-xs text-gray-500 break-all">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Joined {new Date(user.joinedAt).toLocaleDateString()}
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remove User Access</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to remove <strong>{user.fullName}</strong> from this space? 
                            They will lose access to all data and features in this space.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button
                            onClick={() => handleRemoveUser(user.id)}
                            disabled={isRemovingUser}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {isRemovingUser ? (
                              <LoadingSpinner size="small" />
                            ) : (
                              "Remove Access"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SpaceAccessCard;
