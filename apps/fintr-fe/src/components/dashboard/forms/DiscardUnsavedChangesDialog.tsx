"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DiscardUnsavedChangesDialogProps = {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

const DiscardUnsavedChangesDialog: React.FC<DiscardUnsavedChangesDialogProps> = ({
  isOpen,
  onKeepEditing,
  onDiscard,
}) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onKeepEditing();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Discard changes?</DialogTitle>
          <DialogDescription className="text-left">
            This transaction will stay as it was.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onKeepEditing}
          >
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDiscard}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscardUnsavedChangesDialog;
