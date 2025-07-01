import axios from 'axios';
import { MessageSource, SignalMessage } from './message';

type EnvelopeResponse = {
  envelope: {
    dataMessage: {
      message: string;
    };
    source: string;
    timestamp: number;
  };
};

export class PollingMessageSource implements MessageSource {
  private readonly apiUrl: string;

  private readonly number: string;

  private interval: NodeJS.Timeout | null = null;

  private cb: ((msg: SignalMessage) => void) | null = null;

  private seen = new Set<number>();

  private readonly pollInterval: number;

  constructor(apiUrl: string, number: string, pollIntervalSec: number = 5) {
    this.apiUrl = apiUrl;
    this.number = number;
    this.pollInterval = pollIntervalSec * 1000;
  }

  onMessage(cb: (msg: SignalMessage) => void): void {
    this.cb = cb;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => void this.poll(), this.pollInterval);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private async poll() {
    if (!this.cb) return;
    try {
      const resp = await axios.get<EnvelopeResponse>(`${this.apiUrl}/v1/receive/${this.number}`);
      if (resp.status === 204) return;
      console.info('resp', resp);
      const env = resp.data.envelope;
      if (env?.dataMessage?.message) {
        const msg: SignalMessage = {
          text: env.dataMessage.message,
          sender: env.source,
          timestamp: env.timestamp,
        };
        if (!this.seen.has(msg.timestamp)) {
          this.seen.add(msg.timestamp);
          this.cb(msg);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}
