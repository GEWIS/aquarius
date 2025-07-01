export type SignalMessage = {
  text: string;
  sender: string;
  timestamp: number;
};

export interface MessageSource {
  /**
   * Register a callback for incoming messages.
   */
  onMessage(cb: (msg: SignalMessage) => void): void;

  /**
   * Start receiving messages (polling or listening).
   */
  start(): void;

  /**
   * Stop receiving messages (optional for some sources).
   */
  stop?(): void;
}
