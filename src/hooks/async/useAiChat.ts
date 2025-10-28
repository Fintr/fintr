import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthApi } from '@/hooks/useAuthApi';
import { ChatMessage, ChatParams, ChatState } from '@/types/aiChatTypes';
import { startChatQuery, getChatStatus, ChatSession } from '@/services/ai/chat';
import { parseContentWithCharts, detectIncompleteCharts, parseContentWithInlineCharts } from '@/utils/chartParser';

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
    currentStreamingCharts: undefined,
    currentStreamingSegments: undefined,
    hasIncompleteChart: false,
    incompleteChartType: undefined,
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetContentRef = useRef<string>('');
  const displayedContentRef = useRef<string>('');

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
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

  // Function to clean streaming content by hiding chart text
  const cleanStreamingContent = useCallback((content: string) => {
    // Hide chart text that starts with ***** and hasn't ended yet
    return content.replace(/\*\*\*\*\*[^-]+-chart\*\*\*\*\*[\s\S]*?(?=\*\*\*\*\*[^-]+-chart-end\*\*\*\*\*|$)/g, '');
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
    const timeoutMs = 180000; // 3 minutes timeout

    const poll = async () => {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        
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
          error: 'Request timed out after 3 minutes',
          isStreaming: false,
          isLoading: false,
          currentStreamingMessage: '',
        }));
        
        updateMessage(assistantMessageId, {
          content: 'Request timed out after 3 minutes',
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
          
          // Check for incomplete charts during streaming
          const incompleteChartInfo = detectIncompleteCharts(status.content);
          
          // Parse content with inline chart positioning
          const segments = parseContentWithInlineCharts(status.content);
          const hasCharts = segments.some(segment => segment.type === 'chart');
          
          // Clean the streaming content to hide chart text
          const cleanedContent = cleanStreamingContent(status.content);
          
          // Update streaming state
          setChatState(prev => ({
            ...prev,
            isStreaming: status.status === 'streaming' || status.status === 'processing',
            currentStreamingMessage: cleanedContent, // Use cleaned content for streaming
            currentStreamingSegments: hasCharts ? segments : undefined,
            hasIncompleteChart: incompleteChartInfo.hasIncompleteChart,
            incompleteChartType: incompleteChartInfo.chartType,
          }));
          
          // Start typing animation for new content
          if (cleanedContent) {
            startTypingAnimation(cleanedContent);
          }
        }

        // Handle metadata
        if (status.metadata && status.status !== 'processing') {
          updateMessage(assistantMessageId, {
            metadata: {
              confidence: status.metadata.confidence,
              sources: status.metadata.sources,
              aiAnalysis: status.metadata.aiAnalysis,
            },
            rawAiAnalysis: status.rawAiAnalysis,
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
            
            // Parse charts from content with inline positioning
            const segments = parseContentWithInlineCharts(status.content);
            const hasCharts = segments.some(segment => segment.type === 'chart');
            
            // Update the message first
            updateMessage(assistantMessageId, {
              content: status.content, // Keep original content
              segments: hasCharts ? segments : undefined,
            });
            
            // Use a micro-task to ensure React renders the message first
            setTimeout(() => {
              setChatState(prev => ({
                ...prev,
                isStreaming: false,
                isLoading: false,
                currentStreamingMessage: '',
                currentStreamingCharts: undefined,
                currentStreamingSegments: undefined,
                hasIncompleteChart: false,
                incompleteChartType: undefined,
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
        
        // Extract detailed error message from API response
        let errorMessage = 'Polling failed';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Try to extract more specific error details from the API response
        if ((error as any)?.response?.data) {
          const apiError = (error as any).response.data;
          
          // Handle different API error response formats
          if (apiError.error) {
            if (typeof apiError.error === 'string') {
              errorMessage = apiError.error;
            } else if (apiError.error.message) {
              errorMessage = apiError.error.message;
              if (apiError.error.details) {
                errorMessage += `: ${apiError.error.details}`;
              }
            }
          } else if (apiError.message) {
            errorMessage = apiError.message;
          } else if (apiError.details) {
            errorMessage = apiError.details;
          }
        }
        
        setChatState(prev => ({
          ...prev,
          error: errorMessage,
          isStreaming: false,
          isLoading: false,
          currentStreamingMessage: '',
        }));
        
        updateMessage(assistantMessageId, {
          content: errorMessage,
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
  }, [api, updateMessage, startTypingAnimation, cleanStreamingContent]);

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
      openaiRole: 'user',
    });

    // Add placeholder assistant message
    const assistantMessageId = addMessage({
      content: '',
      openaiRole: 'assistant',
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
      const { sessionId, conversationId } = await startChatQuery(api, { 
        query, 
        conversation_id: currentConversationId || undefined
      });
      currentSessionRef.current = sessionId;
      
      // Update conversation ID if we got a new one
      if (conversationId) {
        setCurrentConversationId(conversationId);
      }
      
      // Start polling for updates
      startPolling(sessionId, assistantMessageId);
      
    } catch (error) {
      console.error("Error starting chat:", error);
      
      // Extract detailed error message from API response
      let errorMessage = 'An unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Try to extract more specific error details from the API response
      if ((error as any)?.response?.data) {
        const apiError = (error as any).response.data;
        
        // Handle different API error response formats
        if (apiError.error) {
          if (typeof apiError.error === 'string') {
            errorMessage = apiError.error;
          } else if (apiError.error.message) {
            errorMessage = apiError.error.message;
            if (apiError.error.details) {
              errorMessage += `: ${apiError.error.details}`;
            }
          }
        } else if (apiError.message) {
          errorMessage = apiError.message;
        } else if (apiError.details) {
          errorMessage = apiError.details;
        }
      }
      
      setChatState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        isStreaming: false,
      }));
    }
  }, [addMessage, api, startPolling, currentConversationId]);

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

  const loadConversation = useCallback((conversationId: string, messages: ChatMessage[]) => {
    setCurrentConversationId(conversationId);
    setChatState(prev => ({
      ...prev,
      messages: messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt
      })),
      isLoading: false,
      error: null,
      currentStreamingMessage: '',
      isStreaming: false,
    }));
  }, []);

  const startNewConversation = useCallback(async () => {
    setCurrentConversationId(null);
    setChatState({
      messages: [],
      isLoading: false,
      error: null,
      currentStreamingMessage: '',
      isStreaming: false,
    });
  }, []);

  return {
    ...chatState,
    currentConversationId,
    sendMessage,
    clearChat,
    cancelStreaming,
    loadConversation,
    startNewConversation,
    setCurrentConversationId,
    setChatState,
  };
};
