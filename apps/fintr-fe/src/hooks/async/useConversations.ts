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
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const fetchConversation = async (conversationId: string): Promise<ConversationWithMessages | null> => {
    try {
      return await getConversation(api, conversationId);
    } catch (err) {
      console.error('Error fetching conversation:', err);
      return null;
    }
  };

  const createConversationMutation = useMutation({
    mutationFn: async (params: CreateConversationParams) => {
      try {
        const newConversation = await createConversation(api, params);
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return newConversation;
      } catch (error: any) {
        console.error('Error creating conversation:', error);
        throw error;
      }
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: async ({ conversationId, params }: { conversationId: string; params: UpdateConversationParams }) => {
      try {
        const result = await updateConversation(api, conversationId, params);
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return result;
      } catch (error: any) {
        console.error('Error updating conversation:', error);
        throw error;
      }
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      try {
        const result = await deleteConversation(api, conversationId);
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return result;
      } catch (error: any) {
        console.error('Error deleting conversation:', error);
        throw error;
      }
    },
  });

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
    isCreating: createConversationMutation.isPending,
    updateConversationTitle: (conversationId: string, params: UpdateConversationParams) => 
      updateConversationMutation.mutateAsync({ conversationId, params }),
    isUpdating: updateConversationMutation.isPending,
    removeConversation: deleteConversationMutation.mutateAsync,
    isDeleting: deleteConversationMutation.isPending,
  };
};
