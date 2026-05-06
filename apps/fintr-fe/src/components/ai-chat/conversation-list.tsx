"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit3,
  MoreHorizontal,
  Check
} from "lucide-react";
import { useConversations } from "@/hooks/async/useConversations";
import { Conversation } from "@/types/conversationTypes";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface ConversationListProps {
  currentConversationId?: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onEditConversation: (conversation: Conversation) => void;
  onDropdownToggle?: (isOpen: boolean) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onEditConversation,
  onDropdownToggle,
}) => {
  const { 
    conversations, 
    isLoading, 
    isError,
    error, 
    removeConversation,
    isDeleting
  } = useConversations();
  
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  const handleDeleteConversation = async (conversationId: string) => {
    // Start animation immediately
    setDeletingConversationId(conversationId);
    
    // Wait for animation to complete, then delete
    setTimeout(async () => {
      try {
        await removeConversation(conversationId);
        onDeleteConversation(conversationId);
        // Clear animation state after successful deletion
        setDeletingConversationId(null);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        // Reset animation state on error
        setDeletingConversationId(null);
      }
    }, 300);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Failed to load conversations</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please try refreshing the page
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold text-primary">Conversations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewConversation}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {!conversations || conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a new chat to begin</p>
            </div>
          ) : (
            (conversations || []).map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative p-3 rounded-lg border cursor-pointer transition-all duration-300 ease-in-out hover:bg-muted/50 ${
                  deletingConversationId === conversation.id
                    ? 'transform -translate-x-full opacity-0'
                    : 'transform translate-x-0 opacity-100'
                } ${
                  currentConversationId === conversation.id 
                    ? 'bg-primary/15 border-primary shadow-sm ring-1 ring-primary/20' 
                    : 'border-border hover:border-primary/30'
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {currentConversationId === conversation.id && (
                        <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full" />
                      )}
                      <h4 className={`font-medium text-sm truncate ${
                        currentConversationId === conversation.id 
                          ? 'text-primary font-semibold' 
                          : 'text-foreground'
                      }`}>
                        {conversation.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {conversation.messageCount} messages
                      </Badge>
                      {conversation.lastMessageAt && !isNaN(new Date(conversation.lastMessageAt).getTime()) && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <DropdownMenu onOpenChange={(open) => onDropdownToggle?.(open)}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onEditConversation(conversation);
                      }}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
