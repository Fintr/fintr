"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  MessageSquare, 
  Bot, 
  User, 
  X,
  StopCircle,
  Plus,
  SidebarOpen,
  SidebarClose,
  Trash2
} from "lucide-react";
import { useAiChat } from "@/hooks/async/useAiChat";
import { useAIUsage } from "@/hooks/async/useAIUsage";
import { useConversations } from "@/hooks/async/useConversations";
import { useInfiniteMessages } from "@/hooks/async/useInfiniteMessages";
import { ChatMessage } from "@/types/aiChatTypes";
import { Conversation } from "@/types/conversationTypes";
import { formatDistanceToNow } from "date-fns";
import ConversationList from "./conversation-list";
import ConversationRenameDialog from "./conversation-rename-dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { ChartComponent } from "./chart-components";
import { ChartPlaceholder } from "./chart-placeholder";
import { parseContentWithCharts, parseContentWithInlineCharts } from "@/utils/chartParser";

interface EnhancedAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EnhancedAiChatModal: React.FC<EnhancedAiChatModalProps> = ({ isOpen, onClose }) => {
  const [inputMessage, setInputMessage] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [editingConversation, setEditingConversation] = useState<Conversation | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const { 
    messages, 
    isLoading, 
    error, 
    currentStreamingMessage, 
    isStreaming, 
    currentConversationId,
    currentStreamingCharts,
    currentStreamingSegments,
    hasIncompleteChart,
    incompleteChartType,
    sendMessage, 
    cancelStreaming,
    loadConversation,
    startNewConversation,
    setCurrentConversationId,
    setChatState,
  } = useAiChat();
  
  const { data: aiUsage, isLoading: isLoadingUsage, refetch: refetchAIUsage } = useAIUsage();
  const { fetchConversation, createNewConversation, isCreating } = useConversations();
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Infinite scroll for messages
  const { 
    messages: paginatedMessages, 
    isFetching: isLoadingMessages, 
    isFetchingNextPage: isLoadingMoreMessages,
    hasNextPage: hasMoreMessages,
    setHasUserScrolled,
  } = useInfiniteMessages({
    conversationId: currentConversationId,
    loadMoreRef,
  });

  // Combine and deduplicate messages
  const allMessages = useMemo(() => {
    const messageMap = new Map();
    
    // Add paginated messages first (historical messages)
    paginatedMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // Add current session messages (new messages)
    messages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // Convert back to array and sort by creation time
    return Array.from(messageMap.values()).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [paginatedMessages, messages]);


  // Auto-scroll to bottom when new messages arrive or conversation changes
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        // Try to find the scroll container
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          // Alternative: scroll the ScrollArea itself
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
        
        // Enable infinite scroll after programmatic scroll
        console.log("Programmatic scroll completed, enabling infinite scroll");
        setTimeout(() => {
          setHasUserScrolled(true);
        }, 1000);
      }
    };

    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [allMessages, currentStreamingMessage, setHasUserScrolled]);


  // Refetch AI usage when streaming completes
  useEffect(() => {
    if (!isStreaming && !isLoading && messages.length > 0) {
      refetchAIUsage();
    }
  }, [isStreaming, isLoading, messages.length, refetchAIUsage]);


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage("");
    
    // Clear any existing error
    setChatState(prev => ({
      ...prev,
      error: null,
      currentStreamingMessage: '',
      isStreaming: false,
    }));

    await sendMessage(message, {
      conversation_id: currentConversationId || undefined
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (currentConversationId === conversationId) {
      startNewConversation();
    }
  };

  const handleEditConversation = (conversation: Conversation) => {
    setEditingConversation(conversation);
  };

  const handleConversationUpdated = (updatedConversation: Conversation) => {
    setEditingConversation(null);
  };

  // Touch event handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const minSwipeDistance = 50;
    
    // Check if it's a horizontal swipe (not vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - show sidebar
        setShowSidebar(true);
      } else {
        // Swipe left - hide sidebar
        setShowSidebar(false);
      }
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      // Don't load all messages initially - let infinite scroll handle it
      setCurrentConversationId(conversation.id);
      setChatState({
        messages: [], // Start with empty messages
        isLoading: false,
        error: null,
        currentStreamingMessage: '',
        isStreaming: false,
      });
      // Hide the sidebar after selecting a conversation
      setShowSidebar(false);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConversation = await createNewConversation({
        title: "New Conversation"
      });

      if (newConversation) {
        setCurrentConversationId(newConversation.id);
        setChatState({
          messages: [],
          isLoading: false,
          error: null,
          currentStreamingMessage: '',
          isStreaming: false,
        });
      }
    } catch (error) {
      console.error("Failed to create new conversation:", error);
      startNewConversation();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.openaiRole === 'user';
    
    // Don't render empty assistant messages during streaming
    if (!isUser && (!message.content || message.content.trim() === '') && (isLoading || isStreaming)) {
      return null;
    }
    
    return (
      <div
        key={message.id}
        className={`flex gap-3 p-4 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
            <Bot className="h-4 w-4" />
          </div>
        )}
        
        <div className={`flex flex-col ${isUser ? 'max-w-[80%] items-end' : 'w-full items-start'}`}>
          <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-sm font-medium">
              {isUser ? "You" : "Fintr AI"}
            </span>
            <span className="text-xs text-muted-foreground">
              {message.createdAt && !isNaN(new Date(message.createdAt).getTime()) 
                ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
                : 'Just now'
              }
            </span>
          </div>
          
          <div className={`rounded-lg px-4 py-2 ${
            isUser 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted"
          }`}>
            {message.segments ? (
              // Render segments with inline charts
              <div className="space-y-4">
                {message.segments.map((segment, index) => (
                  <div key={index}>
                    {segment.type === 'text' && segment.content && !segment.content.includes('*****') && (
                      <p className="whitespace-pre-wrap text-sm">{segment.content}</p>
                    )}
                    {segment.type === 'chart' && segment.chart && (
                      <ChartComponent
                        type={segment.chart.type}
                        data={segment.chart.data}
                        title={segment.chart.title}
                        description={segment.chart.description}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Fallback to regular content rendering
              <div>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                {/* Debug: Show if content has chart blocks but no segments */}
                {message.content.includes('*****') && (
                  <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                    <strong>Debug:</strong> Content contains chart markers but no segments. 
                    Content: {message.content.substring(0, 200)}...
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-full h-[100dvh] w-screen flex flex-col m-0 rounded-none border-0 p-0 [&>button]:hidden">
          <div className="relative h-full">
            {/* Backdrop */}
            {showSidebar && (
              <div 
                className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm"
                onClick={(e) => {
                  // Only close if clicking the backdrop itself, not dropdown menus
                  if (e.target === e.currentTarget && !isDropdownOpen) {
                    setShowSidebar(false);
                  }
                }}
              />
            )}
            
            {/* Sidebar Overlay */}
            <div className={`absolute top-0 left-0 z-50 w-80 h-full bg-background border-r shadow-lg transform transition-all duration-300 ease-in-out ${
              showSidebar ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            }`}>
              <ConversationList
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                onDeleteConversation={handleDeleteConversation}
                onEditConversation={handleEditConversation}
                onDropdownToggle={setIsDropdownOpen}
              />
            </div>
            
            {/* Main Chat Area */}
            <div 
              className="w-full h-full flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <DialogHeader className="flex-shrink-0 border-b p-4 pt-safe-top">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSidebar(!showSidebar)}
                      className="h-12 w-12 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                    >
                      {showSidebar ? (
                        <SidebarClose className="h-5 w-5 text-primary" />
                      ) : (
                        <SidebarOpen className="h-5 w-5 text-primary" />
                      )}
                    </button>
                    <DialogTitle className="flex items-center gap-2 text-primary">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Fintr AI Assistant
                    </DialogTitle>
                  </div>
                  
                  <div className="flex items-center gap-2 -ml-5">
                    {isStreaming && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelStreaming}
                        className="h-8 w-8 rounded-full sm:w-auto sm:rounded-md text-primary border-primary hover:bg-primary hover:text-white sm:px-3"
                      >
                        <StopCircle className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Stop</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNewConversation}
                      className="h-8 w-8 rounded-full sm:w-auto sm:rounded-md text-primary border-primary hover:bg-primary hover:text-white sm:px-3"
                    >
                      <Plus className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">New Chat</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="h-8 w-8 rounded-full p-0 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              {/* Token usage display */}
              <div className="flex justify-center py-2 border-b bg-muted/20">
                {isLoadingUsage ? (
                  <LoadingSpinner size="small" />
                ) : aiUsage ? (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Used: {aiUsage.used} / {aiUsage.limit}</span>
                    <span>Remaining: {aiUsage.remaining}</span>
                  </div>
                ) : null}
              </div>
              
              {/* Chat Messages */}
              <ScrollArea ref={scrollAreaRef} className="flex-1">
                {isLoading && allMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <LoadingSpinner />
                  </div>
                ) : allMessages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-primary">Welcome to Fintr AI Assistant!</p>
                    <p className="text-sm mt-2 text-gray-600">
                      Ask me anything about your finances, transactions, or get insights about your spending patterns.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Badge variant="secondary">
                        "Show my spending trends"
                      </Badge>
                      <Badge variant="secondary">
                        "What's my biggest expense category?"
                      </Badge>
                      <Badge variant="secondary">
                        "How much did I spend on dining last month?"
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Load more trigger for infinite scroll */}
                    {hasMoreMessages && (
                      <div ref={loadMoreRef} className="flex justify-center py-4">
                        {isLoadingMoreMessages ? (
                          <LoadingSpinner size="small" />
                        ) : (
                          <div className="text-xs text-muted-foreground">Scroll up to load more messages</div>
                        )}
                      </div>
                    )}
                    
                    {/* Show loading state for initial messages */}
                    {isLoadingMessages && paginatedMessages.length === 0 && (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    )}
                    
                    {/* All messages (deduplicated and sorted) */}
                    {allMessages.map(renderMessage)}
                  </>
                )}
                
                {/* Streaming message */}
                {currentStreamingMessage && (
                  <div className="flex gap-3 p-4 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col w-full items-start">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Fintr AI</span>
                        <span className="text-xs text-muted-foreground">typing...</span>
                      </div>
                      <div className="rounded-lg px-4 py-2 bg-muted">
                        {currentStreamingSegments ? (
                          // Render segments with inline charts
                          <div className="space-y-4">
                            {currentStreamingSegments.map((segment, index) => (
                              <div key={index}>
                                {segment.type === 'text' && segment.content && (
                                  <p className="whitespace-pre-wrap text-sm">{segment.content}</p>
                                )}
                                {segment.type === 'chart' && segment.chart && (
                                  <ChartComponent
                                    type={segment.chart.type}
                                    data={segment.chart.data}
                                    title={segment.chart.title}
                                    description={segment.chart.description}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Fallback to regular content rendering
                          <p className="whitespace-pre-wrap text-sm">{currentStreamingMessage}</p>
                        )}
                        
                        {/* Show placeholder for incomplete chart */}
                        {hasIncompleteChart && incompleteChartType && (
                          <div className="mt-4">
                            <ChartPlaceholder chartType={incompleteChartType} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Error message */}
                {error && (
                  <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                      <X className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
              
              {/* Input Area */}
              <div className="flex-shrink-0 border-t p-4 pb-safe-bottom">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask Fintr AI anything..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="px-4"
                  >
                    {isLoading ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Conversation Rename Dialog */}
      <ConversationRenameDialog
        conversation={editingConversation}
        isOpen={!!editingConversation}
        onClose={() => setEditingConversation(null)}
        onSuccess={handleConversationUpdated}
      />
    </>
  );
};

export default EnhancedAiChatModal;
