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
  useSponsorCodes,
  useCreateSponsorCode,
  useDeleteSponsorCode,
  useUpdateSponsorCode,
} from "@/hooks/async/useSubscriptions";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Users, Percent, Tag, Check, X, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const SponsorCodesPage = () => {
  const { sponsorCodes, isLoading, refetch } = useSponsorCodes();
  const { createSponsorCode, isCreating } = useCreateSponsorCode();
  const { deleteSponsorCode, isDeleting } = useDeleteSponsorCode();
  const { updateSponsorCode } = useUpdateSponsorCode();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [discountMonths, setDiscountMonths] = useState("");

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }

    const data: {
      code: string;
      name: string;
      description?: string;
      discountPercentage?: number;
      discountAmountCents?: number;
      maxUses?: number;
      discountMonths?: number;
    } = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
    };

    if (discountType === "percentage") {
      if (discountPercentage) {
        data.discountPercentage = parseInt(discountPercentage, 10);
      }
    } else {
      if (discountAmount) {
        data.discountAmountCents = parseInt(discountAmount, 10) * 100;
      }
    }

    if (maxUses) {
      data.maxUses = parseInt(maxUses, 10);
    }

    if (discountMonths) {
      data.discountMonths = parseInt(discountMonths, 10);
    }

    try {
      await createSponsorCode(data);
      toast.success("Sponsor code created successfully");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create sponsor code");
    }
  };

  const handleDelete = async () => {
    if (!codeToDelete) return;

    try {
      await deleteSponsorCode(codeToDelete);
      toast.success("Sponsor code deleted");
      setCodeToDelete(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete sponsor code");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateSponsorCode({ id, data: { active: !currentActive } });
      toast.success(`Sponsor code ${currentActive ? "deactivated" : "activated"}`);
      refetch();
    } catch (error: any) {
      toast.error("Failed to update sponsor code");
    }
  };

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountPercentage("");
    setDiscountAmount("");
    setMaxUses("");
    setDiscountMonths("");
  };

  if (isLoading) {
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
          <h1 className="text-2xl sm:text-3xl font-bold">Sponsor Codes</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Create and manage discount codes for sponsors and partners
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Sponsor Codes</CardTitle>
          <CardDescription>
            View usage stats, enable/disable codes, and manage discounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsorCodes.map((sponsorCode) => (
                <TableRow key={sponsorCode.id}>
                  <TableCell className="font-mono font-medium">
                    {sponsorCode.code}
                  </TableCell>
                  <TableCell>{sponsorCode.name}</TableCell>
                  <TableCell>
                    {sponsorCode.discountPercentage ? (
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {sponsorCode.discountPercentage}%
                      </span>
                    ) : sponsorCode.discountAmountCents ? (
                      <span>
                        ₱{(sponsorCode.discountAmountCents / 100).toFixed(2)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {sponsorCode.currentUses}
                      {sponsorCode.maxUses && ` / ${sponsorCode.maxUses}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sponsorCode.active ? "default" : "secondary"}>
                      {sponsorCode.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link href={`/admin/sponsor-codes/${sponsorCode.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(sponsorCode.id, sponsorCode.active)}
                      >
                        {sponsorCode.active ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCodeToDelete(sponsorCode.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sponsorCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No sponsor codes created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Sponsor Code</DialogTitle>
            <DialogDescription>
              Create a discount code that users can apply during subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="e.g., YOUTUBE20"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-gray-500">Users will enter this code</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., YouTube Partner Discount"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Internal notes about this code"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={discountType === "percentage" ? "default" : "outline"}
                  onClick={() => setDiscountType("percentage")}
                >
                  <Percent className="h-4 w-4 mr-2" />
                  Percentage
                </Button>
                <Button
                  type="button"
                  variant={discountType === "amount" ? "default" : "outline"}
                  onClick={() => setDiscountType("amount")}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Fixed Amount
                </Button>
              </div>
            </div>
            {discountType === "percentage" ? (
              <div className="space-y-2">
                <Label htmlFor="percentage">Discount Percentage (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="20"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount">Discount Amount (PHP)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="maxUses">Maximum Uses (optional)</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountMonths">Discount Duration (months, optional)</Label>
              <Input
                id="discountMonths"
                type="number"
                min="1"
                placeholder="Leave blank for unlimited"
                value={discountMonths}
                onChange={(e) => setDiscountMonths(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Number of months the discount applies. After this period, pricing reverts to full amount.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Code"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!codeToDelete} onOpenChange={() => setCodeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sponsor Code</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sponsor code? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SponsorCodesPage;
