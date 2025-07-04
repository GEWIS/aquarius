import { SignalClient } from 'signal-rest-ts';

export interface MessageMention {
  name: string;
  number: string;
  uuid: string;
  start: number;
  length: number;
}

export interface Reaction {
  emoji: string;
  targetAuthor: string;
  targetAuthorNumber: string;
  targetAuthorUuid: string;
  targetSentTimestamp: number;
  isRemove: boolean;
}

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
      reaction?: Reaction;
      mentions?: MessageMention[];
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
