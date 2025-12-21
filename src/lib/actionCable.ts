import { createConsumer, Consumer } from '@rails/actioncable';

let consumer: Consumer | null = null;

/**
 * Creates or returns an existing Action Cable consumer with authentication
 * @param getToken Function to get the auth token
 * @returns Action Cable consumer
 */
export const createActionCableConsumer = async (
  getToken: () => Promise<string>
): Promise<Consumer> => {
  // Always create a new consumer to ensure fresh token
  // Disconnect existing one if present
  if (consumer) {
    consumer.disconnect();
    consumer = null;
  }

  const token = await getToken();
  const baseUrl = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:3000';
  
  // Convert http to ws and https to wss
  // Action Cable uses query parameters for authentication, not headers
  // Handle both http:// and https:// properly
  let wsUrl: string;
  if (baseUrl.startsWith('https://')) {
    wsUrl = baseUrl.replace('https://', 'wss://');
  } else {
    wsUrl = baseUrl.replace('http://', 'ws://');
  }
  wsUrl = `${wsUrl}/cable?token=${encodeURIComponent(token)}`;
  
  console.log('[ActionCable] Creating consumer with URL:', wsUrl.replace(token, '[TOKEN]'));
  
  consumer = createConsumer(wsUrl);
  
  // Log when consumer is created
  console.log('[ActionCable] Consumer created:', consumer);
  
  return consumer;
};

/**
 * Disconnects the Action Cable consumer
 */
export const disconnectActionCable = (): void => {
  if (consumer) {
    consumer.disconnect();
    consumer = null;
  }
};

/**
 * Gets the current consumer instance
 */
export const getConsumer = (): Consumer | null => {
  return consumer;
};

