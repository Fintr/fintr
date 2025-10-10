import { AxiosInstance } from "axios";
import { ChatParams } from "@/types/aiChatTypes";

export interface ChatSession {
  sessionId: string;
}

export interface ChatStatus {
  status: 'processing' | 'streaming' | 'complete' | 'error';
  content: string;
  metadata?: {
    confidence?: number;
    sources?: Array<{
      id: string;
      type: string;
      similarity: number;
      content: string;
    }>;
    ai_analysis?: {
      query_type: string;
      data_sources: string[];
      time_range: {
        period: string;
        start_date?: string;
        end_date?: string;
      };
      filters: Record<string, any>;
    };
  };
  raw_ai_analysis?: string;
  error?: string;
}

export const startChatQuery = async (
  api: AxiosInstance,
  params: ChatParams
): Promise<ChatSession> => {
  try {
    const response = await api.post('/ai/rag/query', params);
    return {
      sessionId: response.data.sessionId || response.data.session_id,
    };
  } catch (error) {
    console.error('Error starting chat session:', error);
    throw error;
  }
};

export const getChatStatus = async (
  api: AxiosInstance,
  sessionId: string
): Promise<ChatStatus> => {
  try {
    const response = await api.get(`/ai/rag/status/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting chat status:', error);
    throw error;
  }
};

