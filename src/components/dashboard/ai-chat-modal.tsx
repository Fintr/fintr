"use client";
import React, { useState, useEffect, useRef } from "react";
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
  StopCircle
} from "lucide-react";
import { useAiChat } from "@/hooks/async/useAiChat";
import { ChatMessage } from "@/types/aiChatTypes";
import { formatDistanceToNow } from "date-fns";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiChatModal: React.FC<AiChatModalProps> = ({ isOpen, onClose }) => {
  const [inputMessage, setInputMessage] = useState("");
  const { 
    messages, 
    isLoading, 
    error, 
    currentStreamingMessage, 
    isStreaming, 
    sendMessage, 
    clearChat, 
    cancelStreaming,
  } = useAiChat();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStreamingMessage]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const messageToSend = inputMessage.trim();
    setInputMessage("");
    await sendMessage(messageToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.isUser;
    
    return (
      <div
        key={message.id}
        className={`flex gap-3 mb-4 ${isUser ? "justify-end" : "justify-start"}`}
      >
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
        )}
        
        <div className={`max-w-[80%] ${isUser ? "order-first" : ""}`}>
          <div
            className={`rounded-lg px-4 py-2 ${
              isUser
                ? "bg-primary text-white ml-auto"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          
          {/* Message metadata */}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
            {message.metadata?.confidence && (
              <Badge variant="secondary" className="text-xs">
                {Math.round(message.metadata.confidence * 100)}% confidence
              </Badge>
            )}
          </div>
          
          {/* AI Analysis Debug Info - only show for assistant messages with analysis */}
          {!isUser && message.raw_ai_analysis && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                🔍 AI Analysis (Debug)
              </summary>
              <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-200">
                <div className="mb-2">
                  <strong>Query Analysis:</strong>
                  <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                    {message.raw_ai_analysis}
                  </pre>
                </div>
                {message.metadata?.ai_analysis && (
                  <div className="text-xs">
                    <div><strong>Query Type:</strong> {message.metadata.ai_analysis.query_type}</div>
                    <div><strong>Data Sources:</strong> {message.metadata.ai_analysis.data_sources?.join(', ')}</div>
                    <div><strong>Time Range:</strong> {message.metadata.ai_analysis.time_range?.period}</div>
                    {message.metadata.ai_analysis.filters && Object.keys(message.metadata.ai_analysis.filters).length > 0 && (
                      <div><strong>Filters:</strong> {JSON.stringify(message.metadata.ai_analysis.filters, null, 2)}</div>
                    )}
                  </div>
                )}
              </div>
            </details>
          )}
          
          
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center">
            <User className="h-4 w-4" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-screen w-screen flex flex-col m-0 rounded-none border-0">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <MessageSquare className="h-5 w-5 text-primary" />
              Fintr AI Assistant
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelStreaming}
                  className="h-8 text-primary border-primary hover:bg-primary hover:text-white"
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              )}
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChat}
                  className="h-8 text-primary border-primary hover:bg-primary hover:text-white"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              {messages.length === 0 && !isLoading && (
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
              )}
              
              {messages
                .filter(message => {
                  // Hide empty assistant messages when loading or streaming
                  if (!message.isUser && !message.content && (isLoading || isStreaming)) {
                    return false;
                  }
                  return true;
                })
                .map(renderMessage)}
              
              {/* Loading or streaming message */}
              {(isLoading || isStreaming) && (
                <div className="flex gap-3 mb-4 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                      <p className="whitespace-pre-wrap">
                        {currentStreamingMessage || "Thinking..."}
                        <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Error message */}
              {error && (
                <div className="flex gap-3 mb-4 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="rounded-lg px-4 py-2 bg-red-50 text-red-800 border border-red-200">
                      <p className="text-sm">Sorry, something went wrong: {error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
        
        {/* Input area */}
        <div className="flex-shrink-0 border-t pt-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your finances..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6"
            >
              {isLoading ? (
                <LoadingSpinner size="small" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AiChatModal;
