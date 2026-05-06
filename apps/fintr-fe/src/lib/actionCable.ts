import { createConsumer, Consumer, Subscription } from '@rails/actioncable';

let consumer: Consumer | null = null;

/**
 * Type for Action Cable messages
 */
export interface ActionCableMessage {
  type: string;
  message?: string;
  [key: string]: any;
}

/**
 * Action Cable client interface
 */
interface ActionCableClient {
  connect: () => Promise<void>;
  subscribe: (channel: string, callback: (message: ActionCableMessage) => void) => void;
  unsubscribe: (channel: string) => void;
}

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

/**
 * Creates an Action Cable client with a simplified interface
 * @param getToken Function to get the auth token
 * @returns Action Cable client with connect, subscribe, and unsubscribe methods
 */
export const getActionCableClient = (
  getToken: () => Promise<string | undefined>
): ActionCableClient => {
  const subscriptions = new Map<string, Subscription>();
  let isConnecting = false;
  let connectionPromise: Promise<void> | null = null;

  const ensureConnected = async (): Promise<void> => {
    // If already connected, return
    if (getConsumer()) {
      return;
    }

    // If currently connecting, wait for that to complete
    if (isConnecting && connectionPromise) {
      return connectionPromise;
    }

    // Start connecting
    isConnecting = true;
    connectionPromise = (async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error('[ActionCable] No token available');
          isConnecting = false;
          return;
        }
        await createActionCableConsumer(async () => token);
      } catch (error) {
        console.error('[ActionCable] Failed to connect:', error);
      } finally {
        isConnecting = false;
      }
    })();

    return connectionPromise;
  };

  return {
    connect: async () => {
      await ensureConnected();
    },

    subscribe: (channel: string, callback: (message: ActionCableMessage) => void) => {
      // Ensure we're connected first (fire and forget - will connect in background)
      ensureConnected().then(() => {
        // Unsubscribe from existing subscription if any
        if (subscriptions.has(channel)) {
          subscriptions.get(channel)?.unsubscribe();
          subscriptions.delete(channel);
        }

        // Get consumer (should be available after ensureConnected)
        const currentConsumer = getConsumer();
        if (!currentConsumer) {
          console.error('[ActionCable] Consumer not available after connection attempt.');
          return;
        }

        // Parse channel string (format: "subscriptions:space_id")
        const spaceId = channel.replace('subscriptions:', '');

        // Create subscription
        const subscription = currentConsumer.subscriptions.create(
          { channel: 'SubscriptionsChannel', space_id: spaceId },
          {
            received: (data: any) => {
              callback(data as ActionCableMessage);
            },
            connected: () => {
              console.log(`[ActionCable] Connected to channel: ${channel}`);
            },
            disconnected: () => {
              console.log(`[ActionCable] Disconnected from channel: ${channel}`);
            },
          }
        );

        subscriptions.set(channel, subscription);
      }).catch((error) => {
        console.error('[ActionCable] Failed to subscribe:', error);
      });
    },

    unsubscribe: (channel: string) => {
      const subscription = subscriptions.get(channel);
      if (subscription) {
        subscription.unsubscribe();
        subscriptions.delete(channel);
        console.log(`[ActionCable] Unsubscribed from channel: ${channel}`);
      }
    },
  };
};

