import { AxiosInstance } from "axios";
import { 
  Conversation, 
  ConversationWithMessages, 
  CreateConversationParams, 
  UpdateConversationParams 
} from "@/types/conversationTypes";

export interface MessagesPage {
  messages: any[];
  nextPage: number | null;
  totalPages: number | null;
  totalCount: number | null;
}

export const getConversations = async (api: AxiosInstance): Promise<Conversation[]> => {
  try {
    const response = await api.get('/ai/conversations');
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export const getConversation = async (
  api: AxiosInstance, 
  conversationId: string
): Promise<ConversationWithMessages> => {
  try {
    const response = await api.get(`/ai/conversations/${conversationId}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
};

export const createConversation = async (
  api: AxiosInstance, 
  params: CreateConversationParams
): Promise<Conversation> => {
  try {
    const response = await api.post('/ai/conversations', params);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

export const updateConversation = async (
  api: AxiosInstance, 
  conversationId: string, 
  params: UpdateConversationParams
): Promise<Conversation> => {
  try {
    const response = await api.patch(`/ai/conversations/${conversationId}`, params);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
};

export const deleteConversation = async (
  api: AxiosInstance, 
  conversationId: string
): Promise<void> => {
  try {
    await api.delete(`/ai/conversations/${conversationId}`);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

export const fetchMessagesPage = async (
  api: AxiosInstance,
  {
    pageParam = 1,
    queryKey,
  }: {
    pageParam?: number;
    queryKey: readonly unknown[];
  }
): Promise<MessagesPage> => {
  const [_key, conversationId] = queryKey as [string, string];

  try {
    const response = await api.get(`/ai/conversations/${conversationId}`, {
      params: {
        page: pageParam,
        per_page: 20, // Load 5 messages per page for testing
      },
    });
    
    const messages = response?.data?.data?.messages || [];
    const totalPages = response?.data?.data?.pagination?.totalPages || 1;
    const totalCount = response?.data?.data?.pagination?.totalCount || 0;
    const currentPage = pageParam;

    // Determine the next page number
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    if (!Array.isArray(messages)) {
      return { messages: [], nextPage: null, totalPages: null, totalCount: null };
    }

    return { messages, nextPage, totalPages, totalCount };
  } catch (error) {
    console.error("Error fetching messages page:", error);
    throw error;
  }
};
