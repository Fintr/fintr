import { useAuthApi } from '@/hooks/useAuthApi';

export interface AiInteraction {
  id: string;
  session_id: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
    code: string;
  };
  request: string;
  enhanced_prompt: string | null;
  response: string | null;
  status: 'pending' | 'success' | 'failure';
  error: string | null;
  tokens_used: number;
  time_seconds: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiInteractionsResponse {
  data: AiInteraction[];
  meta: {
    total_count: number;
    filters: {
      status?: string;
      space_id?: string;
      user_id?: string;
      start_date?: string;
      end_date?: string;
    };
  };
}

export interface AiInteractionStats {
  summary: {
    total_interactions: number;
    successful_interactions: number;
    failed_interactions: number;
    success_rate: number;
    total_tokens: number;
    avg_response_time: number | null;
  };
  status_breakdown: Record<string, number>;
  top_users: Array<{ user: string; count: number }>;
  top_spaces: Array<{ space: string; count: number }>;
  daily_interactions: Record<string, number>;
}

export interface AiInteractionStatsResponse {
  data: AiInteractionStats;
}

export const useAiInteractions = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:ai_usage",
  });

  const fetchAiInteractions = async (filters?: {
    status?: string;
    space_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<AiInteractionsResponse> => {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.space_id) params.append('space_id', filters.space_id);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`/admin/ai/ai_interactions?${params.toString()}`);
    return response.data;
  };

  const fetchAiInteraction = async (id: string): Promise<{ data: AiInteraction }> => {
    const response = await api.get(`/admin/ai/ai_interactions/${id}`);
    return response.data;
  };

  const fetchAiInteractionStats = async (): Promise<AiInteractionStatsResponse> => {
    const response = await api.get('/admin/ai/ai_interactions/stats');
    return response.data;
  };

  return {
    fetchAiInteractions,
    fetchAiInteraction,
    fetchAiInteractionStats,
  };
};
