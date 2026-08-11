import { createConsumer, Consumer, Subscription } from '@rails/actioncable';
import { getActionCableBackendUrl } from '@/lib/public-backend-url';

let consumer: Consumer | null = null;
let consumerPromise: Promise<Consumer> | null = null;

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

const buildCableUrl = (token: string): string => {
  const baseUrl = getActionCableBackendUrl();
  let wsUrl: string;
  if (baseUrl.startsWith('https://')) {
    wsUrl = baseUrl.replace('https://', 'wss://');
  } else {
    wsUrl = baseUrl.replace('http://', 'ws://');
  }
  return `${wsUrl}/cable?token=${encodeURIComponent(token)}`;
};

/**
 * Creates or returns an existing Action Cable consumer with authentication.
 * Reuses a single shared consumer so parallel hooks don't tear each other down.
 */
export const createActionCableConsumer = async (
  getToken: () => Promise<string>
): Promise<Consumer> => {
  if (consumer) {
    return consumer;
  }

  if (consumerPromise) {
    return consumerPromise;
  }

  consumerPromise = (async () => {
    const token = await getToken();
    if (!token) {
      throw new Error('[ActionCable] No access token available');
    }

    // Connect to Rails `/cable` directly (not the Next.js same-origin proxy).
    const wsUrl = buildCableUrl(token);
    console.log(
      '[ActionCable] Creating consumer with URL:',
      wsUrl.replace(token, '[TOKEN]'),
    );

    consumer = createConsumer(wsUrl);
    console.log('[ActionCable] Consumer created');
    return consumer;
  })();

  try {
    return await consumerPromise;
  } finally {
    consumerPromise = null;
  }
};

/**
 * Disconnects the Action Cable consumer
 */
export const disconnectActionCable = (): void => {
  if (consumer) {
    consumer.disconnect();
    consumer = null;
  }
  consumerPromise = null;
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
