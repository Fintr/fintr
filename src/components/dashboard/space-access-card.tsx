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
import { Users, UserPlus, Trash2, Mail, Shield, User, Edit2, Save, X } from "lucide-react";
import { SpaceUser } from "@/types/spaceTypes";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { spacesApi } from "@/services/spaces/api";
import { toast } from "sonner";
import { currentSpaceAtom, availableSpacesAtom } from "@/atoms/spaceAtoms";

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

  // Update space name mutation
  const updateSpaceMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!currentSpace?.id) throw new Error("No space selected");
      const response = await spacesApi.updateSpace(api, currentSpace.id, name);
      return response.data.data.space;
    },
    onSuccess: (updatedSpace) => {
      toast.success("Space name updated successfully");
      setIsEditingSpaceName(false);
      setSpaceName(updatedSpace.name);
      
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
        queryKey: ["space-context", currentSpace?.code] 
      });
      // Also invalidate without code to catch all space-context queries
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
    await updateSpaceMutation.mutateAsync(spaceName.trim());
  };

  const handleCancelEdit = () => {
    setSpaceName(currentSpace?.name || "");
    setIsEditingSpaceName(false);
  };

  // Update spaceName when currentSpace changes
  useEffect(() => {
    if (currentSpace?.name && !isEditingSpaceName) {
      setSpaceName(currentSpace.name);
    }
  }, [currentSpace?.name, isEditingSpaceName]);

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
      <CardContent className="space-y-6">
        {/* Space Name Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Space Name</h4>
            {!isEditingSpaceName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingSpaceName(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
          
          {isEditingSpaceName ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="space-name">Name</Label>
                <Input
                  id="space-name"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="Enter space name"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateSpaceName}
                  disabled={!spaceName.trim() || updateSpaceMutation.isLoading}
                  size="sm"
                >
                  {updateSpaceMutation.isLoading ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  size="sm"
                  disabled={updateSpaceMutation.isLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-gray-700">
              {currentSpace?.name || "Loading..."}
            </div>
          )}
        </div>

        {/* Add User Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Grant Access</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {showAddForm ? "Cancel" : "Add User"}
            </Button>
          </div>

          {showAddForm && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
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
                      <div>
                        <div className="font-medium text-sm">{user.fullName}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
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
