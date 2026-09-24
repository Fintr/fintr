import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthApi } from '@/hooks/useAuthApi';
import { ChatMessage, ChatParams, ChatState } from '@/types/aiChatTypes';
import { startChatQuery, ChatSession } from '@/services/ai/chat';
import { parseContentWithCharts, detectIncompleteCharts, parseContentWithInlineCharts } from '@/utils/chartParser';
import { createActionCableConsumer, getConsumer } from '@/lib/actionCable';
import { Subscription } from '@rails/actioncable';
import { isNativeCapacitor } from '@/lib/capacitor';
import { useAiLlmPriority } from '@/hooks/useAiLlmPriority';
import {
  getOnDeviceLlmReadiness,
  initializeOnDeviceLlm,
  promptOnDeviceLlm,
  resetOnDeviceLlmSession,
  resolveAiLlmRoute,
  shouldFallbackToCloudAfterLocalFailure,
  shouldFallbackToOnDeviceLlm,
} from '@/lib/on-device-llm';

export const useAiChat = () => {
  const { api, getToken } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:ai_usage",
  });
  const { priority: llmPriority } = useAiLlmPriority();

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

  const subscriptionRef = useRef<Subscription | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingAnimationFrameRef = useRef<number | null>(null);
  const targetContentRef = useRef<string>('');
  const displayedContentRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      typingIntervalRef.current = null;
    }
    if (typingAnimationFrameRef.current) {
      cancelAnimationFrame(typingAnimationFrameRef.current);
      typingAnimationFrameRef.current = null;
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

    // Type out new characters with smooth animation
    const startIndex = displayedContentRef.current.length;
    let currentIndex = startIndex;
    const totalChars = targetContent.length - startIndex;
    
    // Calculate adaptive typing speed based on content length
    // For longer content, type faster to keep up with streaming
    // For shorter content, type slower for more natural feel
    const baseSpeed = isComplete ? 10 : 15; // Base delay in ms
    const adaptiveSpeed = Math.max(5, Math.min(baseSpeed, totalChars > 100 ? 8 : baseSpeed));
    
    // Use requestAnimationFrame for smoother animation
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      
      if (elapsed >= adaptiveSpeed && currentIndex < targetContentRef.current.length) {
        // Calculate chunk size based on how far behind we are
        const remaining = targetContentRef.current.length - currentIndex;
        const chunkSize = isComplete 
          ? Math.min(3, remaining) // Type 3 chars at a time when catching up
          : Math.min(2, remaining); // Type 2 chars at a time during streaming
        
        currentIndex = Math.min(currentIndex + chunkSize, targetContentRef.current.length);
        displayedContentRef.current = targetContentRef.current.slice(0, currentIndex);
        
        setChatState(prev => ({
          ...prev,
          currentStreamingMessage: displayedContentRef.current,
        }));
        
        lastTime = currentTime;
      }
      
      if (currentIndex < targetContentRef.current.length) {
        typingAnimationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Finished typing current target
        typingAnimationFrameRef.current = null;
      }
    };
    
    typingAnimationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const subscribeToChat = useCallback(async (conversationId: string, assistantMessageId: string) => {
    // Clear any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Clear timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set timeout for 3 minutes
    timeoutRef.current = setTimeout(() => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      currentSessionRef.current = null;
      
      // Stop typing animation
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      if (typingAnimationFrameRef.current) {
        cancelAnimationFrame(typingAnimationFrameRef.current);
        typingAnimationFrameRef.current = null;
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
    }, 180000); // 3 minutes

    try {
      console.log('[useAiChat] Subscribing to conversation:', conversationId);
      
      // Get or create Action Cable consumer
      const consumer = await createActionCableConsumer(getToken);
      
      console.log('[useAiChat] Creating subscription with params:', {
        channel: 'ChatChannel',
        conversation_id: conversationId
      });
      
      // Subscribe to the chat channel
      subscriptionRef.current = consumer.subscriptions.create(
        {
          channel: 'ChatChannel',
          conversation_id: conversationId
        },
        {
          connected: () => {
            console.log('[useAiChat] ✅ Subscription CONNECTED for conversation:', conversationId);
          },
          disconnected: () => {
            console.log('[useAiChat] ❌ Subscription DISCONNECTED for conversation:', conversationId);
          },
          rejected: () => {
            console.error('[useAiChat] ⛔ Subscription REJECTED for conversation:', conversationId);
          },
          received: (data: any) => {
            console.log('[useAiChat] 📨 Received data:', JSON.stringify(data, null, 2));
            console.log('[useAiChat] Data status:', data.status, 'Type:', typeof data.status);
            console.log('[useAiChat] Data keys:', Object.keys(data));
            
            // Handle processing status (metadata received, but no content yet)
            if (data.status === 'processing' || data.status === "processing") {
              console.log('[useAiChat] Handling processing status');
              setChatState(prev => ({
                ...prev,
                isStreaming: false, // Not streaming yet, just processing
                isLoading: true, // Still loading - show thinking indicator
              }));
              
              // Update metadata if provided
              if (data.metadata) {
                updateMessage(assistantMessageId, {
                  metadata: {
                    confidence: data.metadata.confidence,
                    sources: data.metadata.sources,
                    aiAnalysis: data.metadata.aiAnalysis,
                  },
                  rawAiAnalysis: data.raw_ai_analysis,
                });
              }
            }
            
            // Handle streaming content
            if ((data.status === 'streaming' || data.status === "streaming") && data.content) {
              console.log('[useAiChat] Handling streaming content, length:', data.content?.length);
              
              // Mark as streaming (no longer just loading)
              setChatState(prev => ({
                ...prev,
                isLoading: false, // We have content now, so not just loading
                isStreaming: true,
              }));
              // Check for incomplete charts during streaming
              const incompleteChartInfo = detectIncompleteCharts(data.content);
              
              // Parse content with inline chart positioning
              const segments = parseContentWithInlineCharts(data.content);
              const hasCharts = segments.some(segment => segment.type === 'chart');
              
              // Clean the streaming content to hide chart text
              const cleanedContent = cleanStreamingContent(data.content);
              
              // Update streaming state
              setChatState(prev => ({
                ...prev,
                isStreaming: true,
                currentStreamingMessage: cleanedContent,
                currentStreamingSegments: hasCharts ? segments : undefined,
                hasIncompleteChart: incompleteChartInfo.hasIncompleteChart,
                incompleteChartType: incompleteChartInfo.chartType,
              }));
              
              // Start typing animation for new content
              if (cleanedContent) {
                startTypingAnimation(cleanedContent);
              }
            }

            // Handle metadata (can come with processing or other statuses)
            if (data.metadata) {
              console.log('[useAiChat] Handling metadata');
              updateMessage(assistantMessageId, {
                metadata: {
                  confidence: data.metadata.confidence,
                  sources: data.metadata.sources,
                  aiAnalysis: data.metadata.aiAnalysis,
                },
                rawAiAnalysis: data.raw_ai_analysis,
              });
            }

            // Handle error status
            if (data.status === 'error' || data.status === "error") {
              console.error('[useAiChat] Handling error:', data.error);
              
              // Clear timeout
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              // Stop typing animation
              if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
              }
              
              // Unsubscribe
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
              }
              currentSessionRef.current = null;
              
              // Set error state
              const rawError = data.error ?? 'An error occurred while processing your request';
              const wsErrorText = typeof rawError === 'string' ? rawError : (rawError && typeof (rawError as any).message === 'string' ? (rawError as any).message : String(rawError));
              setChatState(prev => ({
                ...prev,
                error: wsErrorText,
                isLoading: false,
                isStreaming: false,
              }));

              updateMessage(assistantMessageId, {
                content: `Sorry, I encountered an error: ${wsErrorText}`,
              });
              
              return; // Don't process further
            }

            // Handle completion
            if (data.status === 'complete' || data.status === "complete") {
              console.log('[useAiChat] Handling completion');
              
              // If completion has no content, treat it as an error
              if (!data.content || data.content.trim() === '') {
                console.error('[useAiChat] Completion with empty content - treating as error');
                setChatState(prev => ({
                  ...prev,
                  error: 'The AI service did not return any content. Please try again.',
                  isLoading: false,
                  isStreaming: false,
                }));
                
                updateMessage(assistantMessageId, {
                  content: 'Sorry, I did not receive a response. Please try asking your question again.',
                });
                
                // Unsubscribe
                if (subscriptionRef.current) {
                  subscriptionRef.current.unsubscribe();
                  subscriptionRef.current = null;
                }
                currentSessionRef.current = null;
                return;
              }
              
              // Clear timeout
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              // Unsubscribe
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
              }
              currentSessionRef.current = null;
              
              // Use fast typing to catch up to final content
              if (data.content) {
                startTypingAnimation(data.content, true); // true = isComplete for faster speed
              }
              
              // Set a timeout to finish the message after typing catches up
              const estimatedTypingTime = Math.max(0, (data.content.length - displayedContentRef.current.length) * 3);
              setTimeout(() => {
                // Stop typing animation
                if (typingIntervalRef.current) {
                  clearInterval(typingIntervalRef.current);
                  typingIntervalRef.current = null;
                }
                
                // Parse charts from content with inline positioning
                const segments = parseContentWithInlineCharts(data.content);
                const hasCharts = segments.some(segment => segment.type === 'chart');
                
                // Update the message first
                updateMessage(assistantMessageId, {
                  content: data.content, // Keep original content
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
            if (data.status === 'error' || data.status === "error") {
              console.log('[useAiChat] Handling error:', data.error);
              // Clear timeout
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              
              // Unsubscribe
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
              }
              currentSessionRef.current = null;
              
              // Stop typing animation
              if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
              }
              
              setChatState(prev => ({
                ...prev,
                error: data.error || 'An error occurred',
                isStreaming: false,
                isLoading: false,
                currentStreamingMessage: '',
              }));
              
              updateMessage(assistantMessageId, {
                content: data.error || 'An error occurred',
              });
              
              // Reset typing refs
              displayedContentRef.current = '';
              targetContentRef.current = '';
            }
          }
        }
      );
    } catch (error) {
      console.error('Error subscribing to chat channel:', error);
      
      // Extract error message
      let errorMessage = 'Failed to connect to chat stream';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Fallback to error state
      setChatState(prev => ({
        ...prev,
        error: errorMessage,
        isStreaming: false,
        isLoading: false,
      }));
      
      updateMessage(assistantMessageId, {
        content: errorMessage,
      });
    }
  }, [getToken, updateMessage, startTypingAnimation, cleanStreamingContent]);

  const deliverOnDeviceResponse = useCallback(async (
    query: string,
    assistantMessageId: string,
  ): Promise<boolean> => {
    setChatState((prev) => ({
      ...prev,
      isLoading: true,
      isStreaming: true,
      error: null,
      currentStreamingMessage: '',
    }));

    try {
      await initializeOnDeviceLlm();

      const { text } = await promptOnDeviceLlm({
        message: query,
        onChunk: (chunk) => {
          setChatState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: true,
            currentStreamingMessage: chunk,
          }));
        },
      });

      const body = text.trim() || "I couldn't generate a response on this device.";
      const content = `${body}\n\n_(Answered on-device. Switch to Cloud in AI settings for full ledger-aware answers.)_`;

      updateMessage(assistantMessageId, { content });
      setChatState((prev) => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        currentStreamingMessage: '',
      }));
      return true;
    } catch (error) {
      console.error("[useAiChat] on-device LLM failed:", error);
      const message = error instanceof Error
        ? error.message
        : "On-device AI is unavailable on this phone.";

      setChatState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
        isStreaming: false,
        currentStreamingMessage: '',
      }));

      updateMessage(assistantMessageId, {
        content: `Sorry, on-device AI isn't available: ${message}`,
      });
      return false;
    }
  }, [updateMessage]);

  const sendCloudMessage = useCallback(async (
    query: string,
    assistantMessageId: string,
  ) => {
    const { sessionId, conversationId } = await startChatQuery(api, {
      query,
      conversation_id: currentConversationId || undefined,
    });
    currentSessionRef.current = sessionId;

    if (conversationId) {
      setCurrentConversationId(conversationId);
      await subscribeToChat(conversationId, assistantMessageId);
      return;
    }

    setChatState((prev) => ({
      ...prev,
      error: 'Failed to get conversation ID',
      isLoading: false,
    }));
  }, [api, currentConversationId, subscribeToChat]);

  const sendMessage = useCallback(async (query: string, options?: Partial<ChatParams>) => {
    if (!query.trim()) return;

    // Stop any existing subscription and typing animation
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (typingAnimationFrameRef.current) {
      cancelAnimationFrame(typingAnimationFrameRef.current);
      typingAnimationFrameRef.current = null;
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

    const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    let readiness = getOnDeviceLlmReadiness();

    if (isNativeCapacitor() && readiness !== "ready") {
      readiness = await initializeOnDeviceLlm();
    }

    const route = resolveAiLlmRoute({
      priority: llmPriority,
      isNative: isNativeCapacitor(),
      isOnline,
      readiness,
    });

    if (route === "local") {
      const usedLocal = await deliverOnDeviceResponse(query, assistantMessageId);
      if (usedLocal) {
        return;
      }

      if (
        shouldFallbackToCloudAfterLocalFailure({
          priority: llmPriority,
          isOnline,
        })
      ) {
        updateMessage(assistantMessageId, { content: "" });
        setChatState((prev) => ({
          ...prev,
          isLoading: true,
          isStreaming: false,
          error: null,
          currentStreamingMessage: '',
        }));
      } else {
        return;
      }
    }

    try {
      await sendCloudMessage(query, assistantMessageId);
    } catch (error) {
      console.error("Error starting chat:", error);

      if (
        shouldFallbackToOnDeviceLlm({
          isNative: isNativeCapacitor(),
          readiness: getOnDeviceLlmReadiness(),
          error,
          priority: llmPriority,
        })
      ) {
        updateMessage(assistantMessageId, { content: "" });
        await deliverOnDeviceResponse(query, assistantMessageId);
        return;
      }

      // Extract detailed error message from API response (supports snake_case and camelCase)
      let errorMessage: unknown = "An unknown error occurred";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const responseData = (error as any)?.response?.data;
      if (responseData) {
        const err = responseData.error ?? responseData;
        const msg = typeof err === "string" ? err : (err?.message ?? err?.msg);
        if (msg != null) {
          errorMessage = typeof msg === "string" ? msg : String(msg);
          const details = err?.details;
          if (details != null) {
            errorMessage += typeof details === "string" ? `: ${details}` : `: ${JSON.stringify(details)}`;
          }
        } else if (responseData.message != null) {
          errorMessage = typeof responseData.message === "string" ? responseData.message : String(responseData.message);
        }
      }

      const errorText = typeof errorMessage === "string" ? errorMessage : String(errorMessage);

      setChatState((prev) => ({
        ...prev,
        error: errorText,
        isLoading: false,
        isStreaming: false,
      }));

      // Show error in the assistant message bubble so the user sees it in the conversation
      updateMessage(assistantMessageId, {
        content: `Sorry, I encountered an error: ${errorText}`,
      });
    }
  }, [addMessage, currentConversationId, deliverOnDeviceResponse, llmPriority, sendCloudMessage, updateMessage]);

  const clearChat = useCallback(() => {
    // Stop subscription and typing animation
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
    // Stop subscription and typing animation
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      if (typingAnimationFrameRef.current) {
        cancelAnimationFrame(typingAnimationFrameRef.current);
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
    await resetOnDeviceLlmSession();
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
    llmPriority,
    sendMessage,
    clearChat,
    cancelStreaming,
    loadConversation,
    startNewConversation,
    setCurrentConversationId,
    setChatState,
  };
};
