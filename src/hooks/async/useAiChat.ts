import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthApi } from '@/hooks/useAuthApi';
import { ChatMessage, ChatParams, ChatState } from '@/types/aiChatTypes';
import { startChatQuery, getChatStatus, ChatSession } from '@/services/ai/chat';

export const useAiChat = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:ai_usage",
  });

  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    currentStreamingMessage: '',
    isStreaming: false,
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetContentRef = useRef<string>('');
  const displayedContentRef = useRef<string>('');

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setChatState(prev => ({
      ...prev,
      messages: prev.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  const startTypingAnimation = useCallback((targetContent: string, isComplete = false) => {
    // Stop any existing typing animation
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    targetContentRef.current = targetContent;
    
    // If target is shorter than displayed, immediately update
    if (targetContent.length < displayedContentRef.current.length) {
      displayedContentRef.current = targetContent;
      setChatState(prev => ({
        ...prev,
        currentStreamingMessage: targetContent,
      }));
      return;
    }

    // Type out new characters one by one
    const startIndex = displayedContentRef.current.length;
    let currentIndex = startIndex;
    
    // Use faster speed when completing to catch up quickly
    const typingSpeed = isComplete ? 3 : 8; // 3ms for completion, 8ms for streaming
    
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < targetContentRef.current.length) {
        displayedContentRef.current = targetContentRef.current.slice(0, currentIndex + 1);
        setChatState(prev => ({
          ...prev,
          currentStreamingMessage: displayedContentRef.current,
        }));
        currentIndex++;
      } else {
        // Finished typing current target
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }
    }, typingSpeed);
  }, []);

  const startPolling = useCallback((sessionId: string, assistantMessageId: string) => {
    let lastContent = '';
    const startTime = Date.now();
    const timeoutMs = 30000; // 30 seconds timeout

    const poll = async () => {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn('Polling timeout reached (30 seconds)');
        
        // Stop polling immediately
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        currentSessionRef.current = null;
        
        // Stop typing animation
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        
        setChatState(prev => ({
          ...prev,
          error: 'Request timed out after 30 seconds',
          isStreaming: false,
          isLoading: false,
          currentStreamingMessage: '',
        }));
        
        updateMessage(assistantMessageId, {
          content: 'Request timed out after 30 seconds',
        });
        
        // Reset typing refs
        displayedContentRef.current = '';
        targetContentRef.current = '';
        return;
      }
      try {
        const status = await getChatStatus(api, sessionId);
        
        // Update streaming message if content changed
        if (status.content !== lastContent) {
          lastContent = status.content;
          
          // Update streaming state
          setChatState(prev => ({
            ...prev,
            isStreaming: status.status === 'streaming' || status.status === 'processing',
          }));
          
          // Start typing animation for new content
          if (status.content) {
            startTypingAnimation(status.content);
          }
        }

        // Handle metadata
        if (status.metadata && status.status !== 'processing') {
          updateMessage(assistantMessageId, {
            metadata: {
              confidence: status.metadata.confidence,
              sources: status.metadata.sources,
              ai_analysis: status.metadata.ai_analysis,
            },
            raw_ai_analysis: status.raw_ai_analysis,
          });
        }

        // Handle completion
        if (status.status === 'complete') {
          // Stop polling immediately
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          currentSessionRef.current = null;
          
          // Use fast typing to catch up to final content
          if (status.content) {
            startTypingAnimation(status.content, true); // true = isComplete for faster speed
          }
          
          // Set a timeout to finish the message after typing catches up
          const estimatedTypingTime = Math.max(0, (status.content.length - displayedContentRef.current.length) * 3);
          setTimeout(() => {
            // Stop typing animation
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current);
              typingIntervalRef.current = null;
            }
            
            // Update the message first
            updateMessage(assistantMessageId, {
              content: status.content,
            });
            
            // Use a micro-task to ensure React renders the message first
            setTimeout(() => {
              setChatState(prev => ({
                ...prev,
                isStreaming: false,
                isLoading: false,
                currentStreamingMessage: '',
              }));
              
              // Reset typing refs
              displayedContentRef.current = '';
              targetContentRef.current = '';
            }, 0);
          }, estimatedTypingTime + 100); // Add small buffer
        }

        // Handle errors
        if (status.status === 'error') {
          // Stop polling immediately
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          currentSessionRef.current = null;
          
          // Stop typing animation
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
          
          setChatState(prev => ({
            ...prev,
            error: status.error || 'An error occurred',
            isStreaming: false,
            isLoading: false,
            currentStreamingMessage: '',
          }));
          
          updateMessage(assistantMessageId, {
            content: status.error || 'An error occurred',
          });
          
          // Reset typing refs
          displayedContentRef.current = '';
          targetContentRef.current = '';
        }
      } catch (error) {
        console.error('Polling error:', error);
        
        // Stop polling immediately
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        currentSessionRef.current = null;
        
        // Stop typing animation
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        
        setChatState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Polling failed',
          isStreaming: false,
          isLoading: false,
          currentStreamingMessage: '',
        }));
        
        updateMessage(assistantMessageId, {
          content: error instanceof Error ? error.message : 'Polling failed',
        });
        
        // Reset typing refs
        displayedContentRef.current = '';
        targetContentRef.current = '';
      }
    };

    // Start polling every 5 seconds for debugging
    pollingIntervalRef.current = setInterval(poll, 1000);
    
    // Also poll immediately
    poll();
  }, [api, updateMessage, startTypingAnimation]);

  const sendMessage = useCallback(async (query: string, options?: Partial<ChatParams>) => {
    if (!query.trim()) return;

    // Stop any existing polling and typing animation
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    
    // Reset typing state
    displayedContentRef.current = '';
    targetContentRef.current = '';

    addMessage({
      content: query,
      isUser: true,
    });

    // Add placeholder assistant message
    const assistantMessageId = addMessage({
      content: '',
      isUser: false,
    });

    setChatState(prev => ({
      ...prev,
      isLoading: true,
      isStreaming: false,
      error: null,
      currentStreamingMessage: '',
    }));

    try {
      // Start the chat session
      const { sessionId } = await startChatQuery(api, { query });
      currentSessionRef.current = sessionId;
      
      // Start polling for updates
      startPolling(sessionId, assistantMessageId);
      
    } catch (error) {
      console.error("Error starting chat:", error);
      setChatState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
        isStreaming: false,
      }));
    }
  }, [addMessage, api, startPolling]);

  const clearChat = useCallback(() => {
    // Stop polling and typing animation
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    currentSessionRef.current = null;
    
    // Reset typing state
    displayedContentRef.current = '';
    targetContentRef.current = '';
    
    setChatState({
      messages: [],
      isLoading: false,
      error: null,
      currentStreamingMessage: '',
      isStreaming: false,
    });
  }, []);

  const cancelStreaming = useCallback(() => {
    // Stop polling and typing animation
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    currentSessionRef.current = null;
    
    // Reset typing state
    displayedContentRef.current = '';
    targetContentRef.current = '';
    
    setChatState(prev => ({
      ...prev,
      isStreaming: false,
      isLoading: false,
      currentStreamingMessage: '',
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  return {
    ...chatState,
    sendMessage,
    clearChat,
    cancelStreaming,
  };
};
