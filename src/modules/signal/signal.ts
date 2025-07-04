import fs from 'fs/promises';
import { SignalClient } from 'signal-rest-ts';
import axios from 'axios';
import { MessageContext, MessageSource, SignalMessage } from '../../core/message';
import { logger } from '../../core/logger';
import { env } from '../../env';

export class SignalRpcMessageSource implements MessageSource {
  private readonly apiUrl: string;
  private cb: ((msg: SignalMessage) => Promise<void>) | null = null;
  private signalClient: SignalClient | null = null;
  private started = false;
  private groupsCache: { internal_id: string | undefined; id: string | undefined }[] = [];

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async loadGroups(account: string) {
    if (!this.signalClient) return;
    const groups = await this.signalClient.group().getGroups(account);
    this.groupsCache = groups.map((g) => ({ internal_id: g.internal_id, id: g.id }));
    logger.debug(
      'Groups cached:',
      this.groupsCache.map((g) => ({ id: g.id, internal_id: g.internal_id })),
    );
  }

  onMessage(cb: (msg: SignalMessage) => Promise<void>): void {
    this.cb = cb;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.signalClient = new SignalClient(this.apiUrl);

    const accounts = await this.signalClient.account().getAccounts();
    logger.debug('Accounts from REST API:', accounts);

    for (const account of accounts) {
      await this.loadGroups(account);

      // @ts-expect-error typing of the signal-rest-ts package is wrong
      this.signalClient.receive().registerHandler(account, /.*/, async (context: MessageContext) => {
        try {
          if (!this.cb) return;

          const rawGroupId = context.rawMessage?.envelope?.dataMessage?.groupInfo?.groupId;

          const group = rawGroupId ? this.groupsCache.find((g) => g.internal_id === rawGroupId)?.id : undefined;

          const extendedContext: SignalMessage = { ...context, group };

          // check if message mentions bot
          const mentions = extendedContext.rawMessage.envelope.dataMessage.mentions;
          const mention = mentions?.find((m) => m.number === account) !== undefined;
          if (mention) {
            await this.cb(extendedContext);
          }
        } catch (e) {
          console.error(e);
        }
      });

      this.signalClient.receive().startReceiving(account);
    }
    this.started = true;
  }

  stop(): void {
    if (this.signalClient) {
      this.signalClient.receive().stopAllReceiving();
      this.started = false;
    }
  }
}

export async function reply(ctx: SignalMessage, message: string) {
  if (!ctx.client) return;
  if (ctx.group) {
    await ctx.client
      .message()
      .sendMessage({
        number: ctx.account,
        message: message,
        recipients: [ctx.group],
        text_mode: 'styled',
      })
      .catch((e) => logger.error(e));
  } else {
    await ctx.reply(message);
  }
}

export interface Reaction {
  reaction: string;
  recipient: string;
  target_author: string;
  timestamp: number;
}

export async function react(account: string, reaction: Reaction) {
  const apiUrl = env.SIGNAL_CLI_API;
  await axios
    .post(`${apiUrl}/v1/reactions/${account}`, reaction, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((e) => logger.error(e));
}

/**
 * Send an emoji reaction to the message
 */
export async function emoji(ctx: SignalMessage, emoji: string) {
  const recipient = ctx.group || ctx.account; // group id or user number
  const targetAuthor = ctx.rawMessage.envelope.source; // sender UUID of original message
  const timestamp = ctx.rawMessage.envelope.timestamp; // timestamp of original message

  await react(ctx.account, {
    reaction: emoji,
    recipient,
    target_author: targetAuthor,
    timestamp,
  });
}

export async function sendSavedReaction(filePath: string) {
  try {
    const saved: { r: Reaction; account: string } = JSON.parse(await fs.readFile(filePath, 'utf-8')) as {
      r: Reaction;
      account: string;
    };
    await react(saved.account, saved.r);
    await fs.unlink(filePath);
  } catch {
    // noop
  }
}
