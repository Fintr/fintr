"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
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
import { Users, UserPlus, Trash2, Mail, Shield, User, Edit2, Save, X, Info, LogOut, AlertTriangle } from "lucide-react";
import { SpaceUser } from "@/types/spaceTypes";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { spacesApi } from "@/services/spaces/api";
import { updateSpaceSettingsLocalFirst } from "@/services/spaces/update-settings-local-first";
import { toast } from "sonner";
import { currentSpaceAtom, availableSpacesAtom } from "@/atoms/spaceAtoms";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CURRENCY_CODES } from "@/data/currencies";
import { cn } from "@/lib/utils";

type SpaceAccessCardProps = {
  className?: string;
};

const SpaceAccessCard = ({ className }: SpaceAccessCardProps) => {
  const { api } = useAuthApi();
  const { currentSpace, spaceContext } = useSpaceContext(api);
  const { canManageUsers } = useSpacePermissions();
  
  // Use spaceContext for fresh isOwner data, fallback to currentSpace
  const isOwner = spaceContext?.space?.isOwner ?? currentSpace?.isOwner ?? false;
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
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const router = useRouter();

  const updateSpaceMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      currency?: string | null;
      defaultTransactionCurrency?: string | null;
    }) => {
      if (!currentSpace?.id) throw new Error("No space selected");

      const result = await updateSpaceSettingsLocalFirst(
        api,
        {
          space: currentSpace,
          name: params.name,
          ...(params.currency !== undefined ? { currency: params.currency } : {}),
          ...(params.defaultTransactionCurrency !== undefined
            ? {
                defaultTransactionCurrency: params.defaultTransactionCurrency,
              }
            : {}),
        },
        {
          queryClient,
          waitForSync: false,
          setCurrentSpace,
          setAvailableSpaces,
        },
      );

      toast.success("Space updated successfully");
      setIsEditingSpaceName(false);
      setSpaceName(result.localSpace.name);
      setSpaceCurrency(result.localSpace.currency ?? "PHP");
      setDefaultCurrency(
        result.localSpace.defaultTransactionCurrency
          ?? result.localSpace.currency
          ?? "",
      );

      void result.syncPromise.then((synced) => {
        if (synced.pendingSync) {
          toast.message("Update saved on this device. Will sync when online.");
        }
      }).catch(() => {
        toast.error("Failed to sync space update.");
      });

      return result.localSpace;
    },
  });

  const leaveSpaceMutation = useMutation({
    mutationFn: async () => {
      if (!currentSpace?.code) throw new Error("No space selected");
      await spacesApi.leaveSpace(api, currentSpace.code);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: async () => {
      if (!currentSpace?.code) throw new Error("No space selected");
      await spacesApi.deleteSpace(api, currentSpace.code);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!currentSpace?.code) throw new Error("No space selected");
      return spacesApi.transferOwnership(api, currentSpace.code, newOwnerId);
    },
  });

  const [transferDialogUserId, setTransferDialogUserId] = useState<string | null>(null);

  const handleTransferOwnership = (userId: string) => {
    transferOwnershipMutation.mutate(userId, {
      onSuccess: () => {
        toast.success("Ownership transferred successfully. Refreshing...");
        setTransferDialogUserId(null);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      },
      onError: (error: any) => {
        toast.error(
          error.response?.data?.message || "Failed to transfer ownership",
        );
      },
    });
  };

  const handleLeaveSpace = () => {
    leaveSpaceMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Successfully left the space");
        setShowLeaveDialog(false);
        router.push("/dashboard");
        window.location.reload();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || "Failed to leave space");
      },
    });
  };

  const handleDeleteSpace = () => {
    if (deleteConfirmText !== currentSpace?.name) {
      toast.error("Please type the space name to confirm deletion");
      return;
    }
    deleteSpaceMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Space deleted successfully");
        setShowDeleteDialog(false);
        setDeleteConfirmText("");
        router.push("/dashboard");
        window.location.reload();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || "Failed to delete space");
      },
    });
  };

  const handleUpdateSpaceName = async () => {
    if (!spaceName.trim()) {
      toast.error("Space name cannot be empty");
      return;
    }
    try {
      await updateSpaceMutation.mutateAsync({
        name: spaceName.trim(),
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update space name");
    }
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update space name");
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
    if (userRole === "owner") {
      return <Shield className="h-4 w-4 text-amber-600" />;
    } else if (userRole === "admin") {
      return <Shield className="h-4 w-4 text-blue-600" />;
    }
    return <User className="h-4 w-4 text-gray-600" />;
  };

  const getRoleBadgeVariant = (userRole: string): "default" | "secondary" | "destructive" | "outline" => {
    if (userRole === "owner") return "default";
    if (userRole === "admin") return "secondary";
    return "outline";
  };

  // Determine if current user can remove a target user based on role hierarchy
  // Owner: can remove admins and members (not themselves)
  // Admin: can only remove members (not owner, not other admins)
  // Member: cannot remove anyone
  const canRemoveUser = (targetUserRole: string) => {
    // Owner can remove admins and members (but not themselves - owner role)
    if (isOwner) {
      return targetUserRole !== "owner";
    }
    
    // Admin can only remove members
    if (currentSpace?.userRole === "admin") {
      return targetUserRole === "member";
    }
    
    // Members cannot remove anyone
    return false;
  };

  // Show nothing for personal spaces when user can't manage
  if (!canManageUsers && !currentSpace?.isOrganization) {
    return null;
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {canManageUsers ? "Space Access Management" : "Space Settings"}
        </CardTitle>
        <CardDescription>
          {canManageUsers 
            ? "Manage who has access to this space and their permissions"
            : "Manage your membership in this space"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Admin-only sections */}
        {canManageUsers && (
          <>
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
          <p className="text-sm text-muted-foreground">
            Invite other users to use Fintr, then add them here.
            They can switch to your space from Space Management in the menu.
          </p>

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
            <div className="max-h-[21.5rem] overflow-y-auto overscroll-contain sm:max-h-[14.5rem]">
              <div className="space-y-2 pr-1">
              {users.map((user: SpaceUser) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {getRoleIcon(user.role)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium break-words">
                        {user.fullName?.trim() || user.email || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-end justify-between gap-2 sm:w-auto sm:items-center sm:justify-end">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Joined {new Date(user.joinedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                    {/* Transfer Ownership - only show for owner, and not for the owner user */}
                    {isOwner && user.role !== "owner" && (
                      <Dialog
                        open={transferDialogUserId === user.id}
                        onOpenChange={(open) =>
                          setTransferDialogUserId(open ? user.id : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Make owner"
                            className="gap-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Make Owner</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Transfer Ownership</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to transfer ownership of <strong>{currentSpace?.name}</strong> to <strong>{user.fullName || user.email}</strong>?
                              <br /><br />
                              You will become a regular admin and they will become the owner. This action cannot be undone by you.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setTransferDialogUserId(null)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleTransferOwnership(user.id)}
                              disabled={transferOwnershipMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {transferOwnershipMutation.isPending ? (
                                <LoadingSpinner size="small" />
                              ) : (
                                "Transfer Ownership"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Remove button - based on role hierarchy */}
                    {canRemoveUser(user.role) && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Remove user"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
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
                    )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
          </>
        )}

        {/* Danger Zone - Leave/Delete Space */}
        {currentSpace?.isOrganization && (
          <div className="space-y-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
            </div>
            
            <div className="space-y-2">
              {/* Leave Space - only show if NOT owner */}
              {!isOwner && (
                <div className="flex items-center justify-between gap-2 p-2 rounded border bg-background">
                  <div>
                    <p className="text-sm font-medium">Leave this space</p>
                    <p className="text-xs text-muted-foreground">
                      Remove yourself from this space. You can rejoin if invited again.
                    </p>
                  </div>
                  <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10">
                        <LogOut className="h-3.5 w-3.5" />
                        Leave
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Leave Space</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to leave <strong>{currentSpace?.name}</strong>? 
                          You will lose access to all data in this space.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleLeaveSpace}
                          disabled={leaveSpaceMutation.isPending}
                        >
                          {leaveSpaceMutation.isPending ? (
                            <LoadingSpinner size="small" />
                          ) : (
                            "Leave Space"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Delete Space - only show if owner */}
              {isOwner && (
                <div className="flex items-center justify-between gap-2 p-2 rounded border bg-background">
                  <div>
                    <p className="text-sm font-medium">Delete this space</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete this space and all its data. This cannot be undone.
                    </p>
                  </div>
                  <Dialog open={showDeleteDialog} onOpenChange={(open) => {
                    setShowDeleteDialog(open);
                    if (!open) setDeleteConfirmText("");
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Space</DialogTitle>
                        <DialogDescription>
                          This action <strong>cannot be undone</strong>. This will permanently delete 
                          the <strong>{currentSpace?.name}</strong> space and all associated data 
                          including transactions, budgets, and user access.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 py-2">
                        <Label htmlFor="delete-confirm">
                          Type <strong>{currentSpace?.name}</strong> to confirm
                        </Label>
                        <Input
                          id="delete-confirm"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Enter space name"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setShowDeleteDialog(false);
                          setDeleteConfirmText("");
                        }}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteSpace}
                          disabled={deleteConfirmText !== currentSpace?.name || deleteSpaceMutation.isPending}
                        >
                          {deleteSpaceMutation.isPending ? (
                            <LoadingSpinner size="small" />
                          ) : (
                            "Delete Space"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpaceAccessCard;
