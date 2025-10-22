import { AxiosInstance } from "axios";
import { 
  Conversation, 
  ConversationWithMessages, 
  CreateConversationParams, 
  UpdateConversationParams 
} from "@/types/conversationTypes";

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
