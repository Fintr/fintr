import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  [key: string]: any;
}

interface DeleteCategoryDialogProps {
  category: CategoryItem;
  onDelete: (categoryId: string) => Promise<any>;
  isLoading?: boolean;
}

const DeleteCategoryDialog: React.FC<DeleteCategoryDialogProps> = ({
  category,
  onDelete,
  isLoading = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false); // Controls the Dialog's open/close state directly
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UseEffect to log component mount/unmount and state changes
  // REMOVE ALL CONSOLE LOGS

  // This function is called when the DialogTrigger is clicked
  const handleTriggerClick = useCallback(() => {
    setInternalIsOpen(true);
    setErrorMessage(null); // Clear any previous errors when opening
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setErrorMessage(null); // Clear previous errors on new attempt
    
    try {
      const response = await onDelete(category.id);

      if (response?.success === true) {
        toast.success(`Category "${category.name}" has been deleted`);
        setInternalIsOpen(false); // Close on success
        setErrorMessage(null); // Clear error on success
      } else {
        // Backend returned success: false, so display the error message
        const backendMessage = response?.error?.details?.category || response?.error?.message || "Failed to delete category.";
        setErrorMessage(backendMessage);
      }
    } catch (error: any) {
      // This catch is for network errors or unhandled exceptions during the onDelete call
      const errorMessageText = "An unexpected error occurred. Please try again.";
      setErrorMessage(errorMessageText);
    } finally {
      setIsDeleting(false);
    }
  }, [category.id, category.name, onDelete]);

  const handleCancel = useCallback(() => {
    setErrorMessage(null); // Clear error message first
    setInternalIsOpen(false); // Then close the dialog
  }, []);

  // This function is called by the Dialog component whenever its internal open state changes (e.g., via ESC key, click outside)
  const handleOpenChangeFromDialog = useCallback((openStateFromDialog: boolean) => {
    // Always allow the dialog's internal open state to reflect the Dialog component's intent (e.g., from X button, ESC key).
    setInternalIsOpen(openStateFromDialog);
    
    // If the dialog is closing
    if (!openStateFromDialog) {
      setErrorMessage(null); // Clear any error message when the dialog genuinely closes.
    }
  }, []); // No dependencies are needed here, as it directly uses `openStateFromDialog` and modifies `internalIsOpen` and `errorMessage` without reading their stale values.

  return (
    <Dialog open={internalIsOpen} onOpenChange={handleOpenChangeFromDialog}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-delete hover:bg-red-50"
          onClick={handleTriggerClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Are you sure you want to delete the category{" "}
            <span className="font-semibold text-gray-900">"{category.name}"</span>?
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}          

          {/* Removed the warning message display as per request */}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteCategoryDialog; 
