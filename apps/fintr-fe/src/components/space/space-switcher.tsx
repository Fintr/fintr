"use client";
import React from 'react';
import { ChevronDown, Check, Plus, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useSpacePermissions } from "@/hooks/useSpacePermissions";
import { useAuthApi } from "@/hooks/useAuthApi";
import { CreateSpaceDialog } from "@/components/space/create-space-dialog";
import { GrantAccessDialog } from "@/components/space/grant-access-dialog";

interface SpaceSwitcherProps {
  showSpaceSwitcher?: boolean;
  isMobile?: boolean;
  defaultExpanded?: boolean;
}

export function SpaceSwitcher({ 
  showSpaceSwitcher = true, 
  isMobile = true,
  defaultExpanded = false,
}: SpaceSwitcherProps) {
  const { api } = useAuthApi();
  const { spaces, currentSpace, switchSpace, isLoading, isSwitching } = useSpaceContext(api);
  const { canManageUsers } = useSpacePermissions();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showGrantAccessDialog, setShowGrantAccessDialog] = React.useState(false);
  const [showSpaceList, setShowSpaceList] = React.useState(defaultExpanded);

  const handleSpaceSwitch = (spaceCode: string) => {
    if (spaceCode !== currentSpace?.code) {
      switchSpace(spaceCode);
      setShowSpaceList(false);
    }
  };

  const personalSpaces = spaces?.filter(space => space.isPersonal) || [];
  const organizationSpaces = spaces?.filter(space => space.isOrganization) || [];
  
  // Check if any space (other than current) has a new invitation
  const hasNewInvitations = spaces?.some(space => space.code !== currentSpace?.code && space.hasNewInvitation) || false;

  if (!showSpaceSwitcher) {
    return null;
  }

  return (
    <>
      <div className="mb-4 border-b border-gray-200 pb-4 dark:border-border">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-muted-foreground">
            Current Space
          </h4>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSpaceList(!showSpaceList)}
              className="h-6 px-2 text-xs"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showSpaceList ? 'rotate-180' : ''}`} />
            </Button>
            {hasNewInvitations && !showSpaceList && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Current Space Display */}
        <div className="rounded-lg bg-gray-50 p-2 dark:bg-muted">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentSpace?.isOrganization ? 'bg-blue-500' : 'bg-green-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {currentSpace?.name || "Loading..."}
                </span>
              </div>
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-500 dark:text-muted-foreground">
                  {currentSpace?.userRole || "member"}
                </div>
                {canManageUsers && (
                  <button
                    onClick={() => setShowGrantAccessDialog(true)}
                    className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline dark:text-primary-dark-mode dark:hover:text-primary-dark-mode/80"
                  >
                    <Users className="h-3 w-3" />
                    Grant Access
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Space List */}
        {showSpaceList && (
          <div className="mt-2 space-y-1">
            {/* Personal Spaces */}
            {personalSpaces
              .filter(space => space.code !== currentSpace?.code)
              .map((space) => (
                <button
                  key={space.code}
                  onClick={() => handleSpaceSwitch(space.code)}
                  className="flex w-full items-center justify-between rounded p-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      {space.hasNewInvitation && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                    <span className="text-sm">{space.name}</span>
                    {space.hasNewInvitation && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <Check className="h-3 w-3 text-green-600" />
                </button>
              ))
            }
            {/* Organization Spaces */}
            {organizationSpaces
              .filter(space => space.code !== currentSpace?.code)
              .map((space) => (
                <button
                  key={space.code}
                  onClick={() => handleSpaceSwitch(space.code)}
                  className="flex w-full items-center justify-between rounded p-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      {space.hasNewInvitation && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                    <span className="text-sm">{space.name}</span>
                    {space.hasNewInvitation && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {space.userRole}
                    </Badge>
                  </div>
                  <Check className="h-3 w-3 text-green-600" />
                </button>
              ))}

            {/* Create Organization Space */}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex w-full items-center gap-2 rounded p-2 text-left text-sm text-blue-600 transition-colors hover:bg-gray-100 dark:text-primary-dark-mode dark:hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              Create Organization Space
            </button>
          </div>
        )}
      </div>

      {/* Create Space Dialog */}
      <CreateSpaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Grant Access Dialog */}
      <GrantAccessDialog
        open={showGrantAccessDialog}
        onOpenChange={setShowGrantAccessDialog}
      />
    </>
  );
}
