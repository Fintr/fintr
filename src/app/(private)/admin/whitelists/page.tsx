"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useWhitelists } from "@/hooks/async/useWhitelists";
import { WhitelistEntry, CreateWhitelistPayload } from "@/types/adminTypes";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const createWhitelistSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
});

const updateWhitelistSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
});

export default function WhitelistsPage() {
  const { whitelistsQuery, createWhitelistMutation, updateWhitelistMutation, deleteWhitelistMutation } = useWhitelists();
  const { data: whitelists, isLoading, isError } = whitelistsQuery;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedWhitelist, setSelectedWhitelist] = useState<WhitelistEntry | null>(null);

  const createForm = useForm<z.infer<typeof createWhitelistSchema>>({
    resolver: zodResolver(createWhitelistSchema),
    defaultValues: {
      email: "",
    },
  });

  const updateForm = useForm<z.infer<typeof updateWhitelistSchema>>({
    resolver: zodResolver(updateWhitelistSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleCreateSubmit = async (values: z.infer<typeof createWhitelistSchema>) => {
    try {
      await createWhitelistMutation.mutateAsync(values);
      createForm.reset(); // Clear the form field
    } catch (error) {
      // Error handled by mutation's onError
    }
  };

  const handleEditClick = (whitelist: WhitelistEntry) => {
    setSelectedWhitelist(whitelist);
    updateForm.reset({ email: whitelist.email });
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubmit = async (values: z.infer<typeof updateWhitelistSchema>) => {
    if (selectedWhitelist) {
      try {
        await updateWhitelistMutation.mutateAsync({ id: selectedWhitelist.id, email: values.email });
        setIsEditDialogOpen(false);
        setSelectedWhitelist(null);
      } catch (error) {
        // Error handled by mutation's onError
      }
    }
  };

  const handleDeleteClick = (whitelist: WhitelistEntry) => {
    setSelectedWhitelist(whitelist);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedWhitelist) {
      try {
        await deleteWhitelistMutation.mutateAsync({ id: selectedWhitelist.id });
        setIsDeleteDialogOpen(false);
        setSelectedWhitelist(null);
      } catch (error) {
        // Error handled by mutation's onError
      }
    }
  };

  const columns: ColumnDef<WhitelistEntry>[] = [
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleEditClick(row.original)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <p>Loading whitelists...</p>;
  if (isError) return <p>Error loading whitelists.</p>;

  return (
    <div className="container mx-auto py-4">
      <h2 className="text-2xl font-bold mb-6">Whitelisted Emails</h2>

      <div className="mb-6 p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Add New Whitelist Entry</h3>
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <FormField
              control={createForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createWhitelistMutation.isLoading}>
              {createWhitelistMutation.isLoading ? "Adding..." : "Add Whitelist"}
            </Button>
          </form>
        </Form>
      </div>

      <DataTable columns={columns} data={whitelists || []} />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Whitelist Email</DialogTitle>
            <DialogDescription>Update the email for this whitelist entry.</DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(handleUpdateSubmit)} className="space-y-4">
              <FormField
                control={updateForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter new email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateWhitelistMutation.isLoading}>
                  {updateWhitelistMutation.isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the whitelist entry for <strong>{selectedWhitelist?.email}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleteWhitelistMutation.isLoading}>
              {deleteWhitelistMutation.isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
