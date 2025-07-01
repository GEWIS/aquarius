import { SignalClient } from 'signal-rest-ts';

interface RawMessage {
  envelope: {
    source: string;
    sourceNumber: string | null;
    sourceUuid: string;
    sourceName: string;
    sourceDevice: number;
    timestamp: number;
    serverReceivedTimestamp: number;
    serverDeliveredTimestamp: number;
    dataMessage: {
      timestamp: number;
      message: string;
      expiresInSeconds: number;
      viewOnce: boolean;
      mentions?: {
        name: string;
        number: string;
        uuid: string;
        start: number;
        length: number;
      }[];
      groupInfo?: {
        groupId: string;
        groupName: string;
        revision: number;
        type: string;
      };
    };
  };
  account: string;
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
