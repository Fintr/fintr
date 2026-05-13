"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSpacesForFreeSubscription,
  useCreateFreeSubscription,
  useRemoveFreeSubscription,
  useSubscriptionPlans,
} from "@/hooks/async/useSubscriptions";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import { toast } from "sonner";
import {
  Loader2,
  Gift,
  Search,
  User,
  Building2,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatApiErrorMessage } from "@/utils/errorUtils";

const FreeSubscriptionsPage = () => {
  const { spaces, isLoading: isLoadingSpaces, refetch } = useSpacesForFreeSubscription();
  const { plans, isLoading: isLoadingPlans } = useSubscriptionPlans();
  const { createFreeSubscription, isCreating } = useCreateFreeSubscription();
  const { removeFreeSubscription, isRemoving } = useRemoveFreeSubscription();

  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<typeof spaces[0] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const handleGrant = async () => {
    if (!selectedSpace || !selectedPlanId) {
      toast.error("Please select a space and plan");
      return;
    }

    try {
      await createFreeSubscription({
        spaceId: selectedSpace.id,
        subscriptionPlanId: selectedPlanId,
        notes: notes.trim() || undefined,
      });
      toast.success(`Free subscription granted to ${selectedSpace.name}`);
      setShowGrantDialog(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(
        formatApiErrorMessage(
          error,
          "Failed to grant free subscription"
        )
      );
    }
  };

  const handleRemove = async (spaceId: string, spaceName: string) => {
    try {
      await removeFreeSubscription({ spaceId });
      toast.success(`Free subscription removed from ${spaceName}`);
      refetch();
    } catch (error: any) {
      toast.error(
        formatApiErrorMessage(
          error,
          "Failed to remove free subscription"
        )
      );
    }
  };

  const resetForm = () => {
    setSelectedSpace(null);
    setSelectedPlanId("");
    setNotes("");
  };

  const filteredSpaces = spaces.filter((space) =>
    space.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    space.ownerEmail?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    space.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  const activePlans = plans.filter((plan) => plan.active);

  if (isLoadingSpaces || isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            Free Subscriptions
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Grant free subscriptions to vloggers, partners, and supporters
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Spaces</CardTitle>
          <CardDescription>
            Find the space you want to grant a free subscription to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by space name, owner email, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spaces</CardTitle>
          <CardDescription>
            Select a space to grant a free subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpaces.map((space) => (
                <TableRow key={space.id}>
                  <TableCell>
                    <div className="font-medium">{space.name}</div>
                    <div className="text-xs text-gray-500">{space.code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {space.type === "Personal" ? (
                        <User className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Building2 className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">{space.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{space.ownerEmail}</div>
                    {space.ownerName && (
                      <div className="text-xs text-gray-500">{space.ownerName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {space.hasActiveSubscription ? (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <CheckCircle className="h-3 w-3" />
                        {space.subscriptionType} ({space.subscriptionStatus})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <XCircle className="h-3 w-3" />
                        No subscription
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSpace(space);
                          setShowGrantDialog(true);
                        }}
                        disabled={space.hasActiveSubscription}
                      >
                        <Gift className="h-4 w-4 mr-2" />
                        Grant Free
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemove(space.id, space.name)}
                        disabled={!space.hasActiveSubscription || space.subscriptionType !== "free" || isRemoving}
                      >
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSpaces.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    {searchQuery ? "No spaces found matching your search" : "No spaces available"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Grant Free Subscription Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grant Free Subscription</DialogTitle>
            <DialogDescription>
              Grant a free subscription to {selectedSpace?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedSpace && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                {selectedSpace.type === "Personal" ? (
                  <User className="h-5 w-5 text-gray-600" />
                ) : (
                  <Building2 className="h-5 w-5 text-gray-600" />
                )}
                <span className="font-semibold">{selectedSpace.name}</span>
                <Badge variant="outline">{selectedSpace.type}</Badge>
              </div>
              <div className="text-sm text-gray-600">
                Owner: {selectedSpace.ownerEmail}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Subscription Plan *</Label>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.tokenLimit} tokens/{plan.interval}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="e.g., YouTube partner - Tech Review Channel"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Internal notes about why this free subscription was granted
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={isCreating || !selectedPlanId}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Granting...
                </>
              ) : (
                "Grant Free Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FreeSubscriptionsPage;
