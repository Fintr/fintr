import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Account } from "@/types/accountTypes";

interface EditAccountDialogProps {
  account: Account;
  onUpdate: (accountId: string, newName: string) => Promise<void>;
  isLoading?: boolean;
}

const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  account,
  onUpdate,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [accountName, setAccountName] = useState(account.name);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset form when account changes or dialog opens
  useEffect(() => {
    setAccountName(account.name);
  }, [account.name, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountName.trim()) {
      toast.error("Account name cannot be empty");
      return;
    }

    if (accountName.trim() === account.name) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(account.id, accountName.trim());
      toast.success(`Account updated to "${accountName.trim()}"`);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update account:", error);
      toast.error("Failed to update account");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setAccountName(account.name); // Reset to original name
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:bg-blue-50"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Enter account name"
              disabled={isUpdating}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !accountName.trim()}
            >
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditAccountDialog; 
