export interface ActionCableMessage {
  type: string;
  subscription_id?: string;
  space_id?: string;
  message?: string;
}

class ActionCableClient {
  private cable: WebSocket | null = null;
  private subscriptions: Map<string, (message: ActionCableMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private getToken: () => Promise<string | undefined>;

  constructor(getToken: () => Promise<string | undefined>) {
    this.getToken = getToken;
  }

  async connect(): Promise<void> {
    if (this.cable && this.cable.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const token = await this.getToken();
      if (!token) {
        console.error("Action Cable: No access token available");
        return;
      }

      // Get the backend URL from environment or use default
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const wsUrl = backendUrl.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
      const cableUrl = `${wsUrl}/cable?token=${encodeURIComponent(token)}`;

      this.cable = new WebSocket(cableUrl);

      this.cable.onopen = () => {
        console.log("Action Cable: Connected");
        this.reconnectAttempts = 0;
        // Resubscribe to all channels
        this.resubscribeAll();
      };

      this.cable.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("Action Cable: Failed to parse message", error);
        }
      };

      this.cable.onerror = (error) => {
        console.error("Action Cable: Error", error);
      };

      this.cable.onclose = () => {
        console.log("Action Cable: Disconnected");
        this.cable = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Action Cable: Failed to connect", error);
      this.attemptReconnect();
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Action Cable: Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Action Cable: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  subscribe(channel: string, callback: (message: ActionCableMessage) => void): void {
    this.subscriptions.set(channel, callback);

    const subscribeToChannel = () => {
      if (this.cable && this.cable.readyState === WebSocket.OPEN) {
        const spaceId = this.extractSpaceId(channel);
        this.send({
          command: "subscribe",
          identifier: JSON.stringify({ channel: "SubscriptionsChannel", space_id: spaceId }),
        });
      }
    };

    if (this.cable && this.cable.readyState === WebSocket.OPEN) {
      subscribeToChannel();
    } else {
      // Connect first if not connected, then subscribe
      this.connect().then(() => {
        // Wait a bit for connection to be established
        setTimeout(subscribeToChannel, 500);
      });
    }
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);

    if (this.cable && this.cable.readyState === WebSocket.OPEN) {
      const spaceId = this.extractSpaceId(channel);
      this.send({
        command: "unsubscribe",
        identifier: JSON.stringify({ channel: "SubscriptionsChannel", space_id: spaceId }),
      });
    }
  }

  private extractSpaceId(channel: string): string | undefined {
    // Extract space_id from channel name like "subscriptions:space-id"
    const match = channel.match(/subscriptions:(.+)/);
    return match ? match[1] : undefined;
  }

  private resubscribeAll(): void {
    // Wait a bit for connection to stabilize before resubscribing
    setTimeout(() => {
      this.subscriptions.forEach((callback, channel) => {
        const spaceId = this.extractSpaceId(channel);
        this.send({
          command: "subscribe",
          identifier: JSON.stringify({ channel: "SubscriptionsChannel", space_id: spaceId }),
        });
      });
    }, 500);
  }

  private handleMessage(data: any): void {
    // Action Cable protocol messages
    // Note: ping/pong is handled automatically by Action Cable, no need to respond manually
    if (data.type === "ping") {
      // Action Cable handles pong automatically, just ignore ping messages
      return;
    }

    if (data.type === "confirm_subscription") {
      console.log("Action Cable: Subscribed to", data.identifier);
      return;
    }

    if (data.type === "reject_subscription") {
      console.error("Action Cable: Subscription rejected", data.identifier);
      return;
    }

    // Handle broadcast messages
    // Action Cable broadcasts send the data directly (not nested in 'message')
    // But we need to check both formats for compatibility
    const messageData = data.message || data;
    
    if (messageData && messageData.type === "subscription_updated") {
      const spaceId = messageData.space_id;
      if (spaceId) {
        const channel = `subscriptions:${spaceId}`;
        const callback = this.subscriptions.get(channel);
        if (callback) {
          callback(messageData);
        } else {
          console.warn("Action Cable: No callback found for channel", channel);
        }
      }
    }
  }

  private send(data: any): void {
    if (this.cable && this.cable.readyState === WebSocket.OPEN) {
      this.cable.send(JSON.stringify(data));
    } else {
      console.warn("Action Cable: Cannot send message, not connected");
    }
  }

  disconnect(): void {
    if (this.cable) {
      this.cable.close();
      this.cable = null;
    }
    this.subscriptions.clear();
  }
}

// Singleton instance
let actionCableClient: ActionCableClient | null = null;

export function getActionCableClient(getToken: () => Promise<string | undefined>): ActionCableClient {
  if (!actionCableClient) {
    actionCableClient = new ActionCableClient(getToken);
  }
  return actionCableClient;
}

