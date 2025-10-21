export interface ChartData {
  type: string;
  data: Record<string, any>;
  title?: string;
  description?: string;
}

export interface MessageSegment {
  type: 'text' | 'chart';
  content?: string;
  chart?: ChartData;
}

export interface ChatMessage {
  id: string;
  content: string;
  openaiRole: 'user' | 'assistant' | 'developer';
  createdAt: string;
  metadata?: {
    confidence?: number;
    sources?: Array<{
      id: string;
      type: string;
      similarity: number;
      content: string;
    }>;
    aiAnalysis?: {
      queryType: string;
      dataSources: string[];
      timeRange: {
        period: string;
        startDate?: string;
        endDate?: string;
      };
      filters: Record<string, any>;
    };
  };
  rawAiAnalysis?: string;
  charts?: ChartData[];
  segments?: MessageSegment[];
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
  conversation_id?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  currentStreamingMessage: string;
  isStreaming: boolean;
  currentStreamingCharts?: ChartData[];
  currentStreamingSegments?: MessageSegment[];
  hasIncompleteChart?: boolean;
  incompleteChartType?: string;
}
