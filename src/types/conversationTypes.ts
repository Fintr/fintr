export interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  content: string;
  openaiRole: 'user' | 'assistant' | 'developer';
  metadata: Record<string, any>;
  createdAt: string;
}

export interface CreateConversationParams {
  title?: string;
}

export interface UpdateConversationParams {
  title?: string;
}
