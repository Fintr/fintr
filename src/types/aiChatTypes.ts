export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
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
}

export interface StreamingEvent {
  event: 'metadata' | 'content' | 'complete' | 'error';
  data: {
    content?: string;
    message?: string;
    query?: string;
    confidence?: number;
    sources?: Array<{
      id: string;
      type: string;
      similarity: number;
      content: string;
    }>;
  };
}

export interface ChatParams {
  query: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentStreamingMessage: string;
  isStreaming: boolean;
}
