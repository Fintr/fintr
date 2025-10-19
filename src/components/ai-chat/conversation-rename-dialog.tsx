"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Conversation } from "@/types/conversationTypes";
import { useConversations } from "@/hooks/async/useConversations";

interface ConversationRenameDialogProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedConversation: Conversation) => void;
}

const ConversationRenameDialog: React.FC<ConversationRenameDialogProps> = ({
  conversation,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const { updateConversationTitle, isUpdating } = useConversations();

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title);
    }
  }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !title.trim()) return;

    try {
      const updatedConversation = await updateConversationTitle(conversation.id, {
        title: title.trim(),
      });
      
      if (updatedConversation) {
        onSuccess(updatedConversation);
        onClose();
      }
    } catch (error) {
      console.error("Failed to update conversation:", error);
    }
  };

  const handleClose = () => {
    setTitle("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Conversation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Conversation Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter conversation title..."
                maxLength={100}
                required
              />
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !title.trim()}
            >
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConversationRenameDialog;
