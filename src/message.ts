import { SignalClient } from 'signal-rest-ts';

interface RawMessage {
  envelope: {
    source: string; // UUID of sender device
    sourceNumber: string | null; // Usually null for sealed sender
    sourceUuid: string;
    sourceName: string;
    sourceDevice: number;
    timestamp: number; // Message timestamp
    serverReceivedTimestamp: number;
    serverDeliveredTimestamp: number;
    dataMessage: {
      timestamp: number;
      message: string;
      expiresInSeconds: number;
      viewOnce: boolean;
      groupInfo?: {
        groupId: string;
        groupName: string;
        revision: number;
        type: string; // e.g. "DELIVER"
      };
    };
  };
  account: string; // Your bot's registered number
}

export interface MessageContext {
  message: string;
  sourceUuid: string;
  rawMessage: RawMessage;
  account: string;
  client?: SignalClient;
  reply: (message: string) => Promise<void>;
}

export interface SignalMessage extends MessageContext {
  group?: string;
}

export interface MessageSource {
  /**
   * Register a callback for incoming messages.
   */
  onMessage(cb: (msg: SignalMessage) => Promise<void>): void;

  /**
   * Start receiving messages (polling or listening).
   */
  start(): Promise<void>;

  /**
   * Stop receiving messages (optional for some sources).
   */
  stop?(): void;
}
