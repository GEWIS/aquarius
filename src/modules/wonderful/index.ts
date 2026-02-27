import axios from 'axios';
import { CommandContext } from '../../commands';
import { isABC } from '../../commands/policy';
import { ModuleApi } from '../../core/module-api';
import { logger } from '../../core/logger';
import { env } from '../../env';
import { emoji, reply } from '../signal/signal';
import {
  buildWonderfulPayload,
  extractCreatedTaskId,
  extractTaskAndEvents,
  pickAgentTexts,
  sleep,
  WonderfulCreateTaskResponse,
  WonderfulGetTaskResponse,
} from './wonderful';

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function extractReplyText(ctx: CommandContext): string | undefined {
  const dm = ctx.msg.rawMessage?.envelope?.dataMessage;
  const direct = dm?.quote?.text;
  if (typeof direct === 'string' && direct.trim() !== '') return direct;

  // Fallback for alternate shapes (signal-cli-rest-api variants).
  const anyDm = dm as unknown as Record<string, unknown> | undefined;
  const quote = (anyDm?.quote as Record<string, unknown> | undefined) ?? undefined;
  const alt =
    (typeof quote?.message === 'string' && quote.message) ||
    (typeof quote?.body === 'string' && quote.body) ||
    undefined;
  return typeof alt === 'string' && alt.trim() !== '' ? alt : undefined;
}

async function pollWonderfulTask(
  ctx: CommandContext,
  taskId: string,
  opts: {
    apiUrl: string;
    apiKey: string;
    pollIntervalMs: number;
    pollTimeoutMs: number;
    terminalGraceMs: number;
  },
): Promise<void> {
  const { apiUrl, apiKey, pollIntervalMs, pollTimeoutMs, terminalGraceMs } = opts;
  const deadline = Date.now() + pollTimeoutMs;
  let lastSeenEventIndex = -1;
  let terminalStatus: 'completed' | 'failed' | null = null;
  let terminalGraceUntil: number | null = null;
  let emittedAnyAgentText = false;

  try {
    while (Date.now() < deadline) {
      try {
        const remainingMs = deadline - Date.now();
        const requestTimeoutMs = Math.max(5_000, Math.min(30_000, remainingMs));
        const res = await axios.get<WonderfulGetTaskResponse>(`${apiUrl.replace(/\/$/, '')}/api/v1/tasks/${taskId}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          timeout: requestTimeoutMs,
        });

        const { task, events } = extractTaskAndEvents(res.data);
        const picked = pickAgentTexts(events, lastSeenEventIndex);
        lastSeenEventIndex = picked.newLastSeenEventIndex;

        for (const text of picked.texts) {
          emittedAnyAgentText = true;
          await reply(ctx.msg, text);
        }

        const status = task?.status;
        if (status === 'completed' || status === 'failed') {
          if (terminalStatus === null) {
            terminalStatus = status;
            terminalGraceUntil = Math.min(deadline, Date.now() + terminalGraceMs);
          }
          if (terminalGraceUntil !== null && Date.now() >= terminalGraceUntil) {
            if (!emittedAnyAgentText) {
              const fallback =
                terminalStatus === 'failed'
                  ? (task?.error_reason ?? task?.resolution_summary)
                  : task?.resolution_summary;
              if (fallback) await reply(ctx.msg, fallback);
            }

            await emoji(ctx.msg, terminalStatus === 'completed' ? '✅' : '❌');
            return;
          }
        } else if (status && status !== 'pending' && status !== 'live') {
          await emoji(ctx.msg, '❌');
          await reply(ctx.msg, `Wonderful task ended with status: ${status}`);
          return;
        }
      } catch (e) {
        if (axios.isAxiosError(e)) {
          logger.error(
            `Failed to poll Wonderful task (status=${e.response?.status ?? 'n/a'} url=${e.config?.url ?? 'n/a'}): ${e.message}`,
          );
        } else {
          logger.error(`Failed to poll Wonderful task: ${String(e)}`);
        }
      }

      await sleep(pollIntervalMs);
    }

    await emoji(ctx.msg, '⏱️');
    logger.warn(`Wonderful polling timed out for task ${taskId}`);
  } catch (e) {
    logger.error(`Unexpected error in Wonderful background poller for task ${taskId}: ${String(e)}`);
  }
}

export function registerWonderfulModule(api: ModuleApi) {
  const { commands } = api;

  const configured =
    env.WONDERFUL_WEBHOOK_URL !== '' &&
    env.WONDERFUL_WEBHOOK_SECRET !== '' &&
    env.WONDERFUL_API_URL !== '' &&
    env.WONDERFUL_API_KEY !== '';
  if (!configured) {
    logger.warn('Wonderful is not fully configured (missing env vars). Command will be available but will fail.');
  }

  commands.register({
    description: {
      name: 'wonderful',
      args: [{ name: 'message', required: true, description: 'Message to send to Wonderful' }],
      description: 'Send a task to the Wonderful backoffice agent',
      aliases: ['w'],
    },
    policy: isABC,
    handler: async (ctx: CommandContext) => {
      const payload = buildWonderfulPayload(ctx.args, extractReplyText(ctx));
      if (!payload) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, 'Usage: wonderful <message>');
        return;
      }

      const { WONDERFUL_WEBHOOK_URL, WONDERFUL_WEBHOOK_SECRET, WONDERFUL_API_URL, WONDERFUL_API_KEY } = env;
      if (
        WONDERFUL_WEBHOOK_URL === '' ||
        WONDERFUL_WEBHOOK_SECRET === '' ||
        WONDERFUL_API_URL === '' ||
        WONDERFUL_API_KEY === ''
      ) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, 'Wonderful is not configured. Missing env vars.');
        return;
      }

      const pollIntervalMs = parsePositiveInt(env.WONDERFUL_POLL_INTERVAL_MS, 2000);
      const pollTimeoutMs = parsePositiveInt(env.WONDERFUL_POLL_TIMEOUT_MS, 300_000);
      const terminalGraceMs = Math.min(parsePositiveInt(env.WONDERFUL_TERMINAL_GRACE_MS, 20_000), pollTimeoutMs);

      await emoji(ctx.msg, '🔄');

      let taskId: string;
      try {
        const res = await axios.post<WonderfulCreateTaskResponse>(WONDERFUL_WEBHOOK_URL, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': WONDERFUL_WEBHOOK_SECRET,
          },
          timeout: 10_000,
        });
        taskId = extractCreatedTaskId(res.data) ?? '';
      } catch (e) {
        if (axios.isAxiosError(e)) {
          logger.error(
            `Failed to create Wonderful task via webhook (status=${e.response?.status ?? 'n/a'} url=${e.config?.url ?? 'n/a'}): ${e.message}`,
          );
        } else {
          logger.error(`Failed to create Wonderful task: ${String(e)}`);
        }
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, 'Failed to create Wonderful task.');
        return;
      }

      if (taskId === '') {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, 'Wonderful task created but no task id was returned.');
        return;
      }

      // Poll in the background — handler returns immediately so the bot stays
      // responsive while the agent works.
      void pollWonderfulTask(ctx, taskId, {
        apiUrl: WONDERFUL_API_URL,
        apiKey: WONDERFUL_API_KEY,
        pollIntervalMs,
        pollTimeoutMs,
        terminalGraceMs,
      });
    },
  });
}
