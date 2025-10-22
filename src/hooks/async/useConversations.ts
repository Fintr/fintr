import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { 
  Conversation, 
  ConversationWithMessages, 
  CreateConversationParams, 
  UpdateConversationParams 
} from '@/types/conversationTypes';
import { 
  getConversations, 
  getConversation, 
  createConversation, 
  updateConversation, 
  deleteConversation 
} from '@/services/conversations/api';

export const useConversations = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:ai_usage",
  });
  const queryClient = useQueryClient();

  // Fetch conversations query
  const {
    data: conversations,
    isLoading,
    isError,
    error,
    refetch: fetchConversations
  } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => getConversations(api),
    enabled: !!api,
    staleTime: 2 * 60 * 1000, // Data considered fresh for 2 minutes
    cacheTime: 5 * 60 * 1000, // Data stays in cache for 5 minutes
  });

  // Fetch single conversation query
  const fetchConversation = async (conversationId: string): Promise<ConversationWithMessages | null> => {
    try {
      return await getConversation(api, conversationId);
    } catch (err) {
      console.error('Error fetching conversation:', err);
      return null;
    }
  };

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (params: CreateConversationParams) => 
      createConversation(api, params),
    onSuccess: (newConversation) => {
      // Invalidate and refetch conversations
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Error creating conversation:', error);
    },
  });

  // Update conversation mutation
  const updateConversationMutation = useMutation({
    mutationFn: ({ conversationId, params }: { conversationId: string; params: UpdateConversationParams }) => 
      updateConversation(api, conversationId, params),
    onSuccess: () => {
      // Invalidate and refetch conversations
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Error updating conversation:', error);
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => deleteConversation(api, conversationId),
    onSuccess: () => {
      // Invalidate and refetch conversations
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Error deleting conversation:', error);
    },
  });

  // Helper function to get conversations data
  const getConversationsData = (): Conversation[] => {
    if (!conversations) return [];
    return Array.isArray(conversations) ? conversations : [];
  };

  return {
    conversations: getConversationsData(),
    isLoading,
    isError,
    error,
    fetchConversations,
    fetchConversation,
    createNewConversation: createConversationMutation.mutateAsync,
    isCreating: createConversationMutation.isLoading,
    updateConversationTitle: (conversationId: string, params: UpdateConversationParams) => 
      updateConversationMutation.mutateAsync({ conversationId, params }),
    isUpdating: updateConversationMutation.isLoading,
    removeConversation: deleteConversationMutation.mutateAsync,
    isDeleting: deleteConversationMutation.isLoading,
  };
};
