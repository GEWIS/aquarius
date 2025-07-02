import fs from 'fs/promises';
import { Commands, CommandHandler } from '../commands';
import { reply, emoji } from '../signal';
import { Portainer } from '../portainer';
import { Stack } from '../portainer.types';
import { SignalMessage } from '../message';
import { logger, UPDATE_REQUEST_MESSAGE } from '../index';
import { env } from '../env';

export function registerPortainerCommands(commands: Commands, portainer: Portainer) {
  const wrap = (fn: CommandHandler): CommandHandler => fn;

  commands.register(
    'stacks',
    wrap(async (ctx) => {
      const stacks = await portainer.listStacks();
      if (stacks.length === 0) return reply(ctx, 'No stacks found.');
      const msg = stacks.map((s) => `• ${s.Name} (stack: ${s.Id})`).join('\n');
      await reply(ctx, `Stacks:\n${msg}`);
    }),
    {
      name: 'stacks',
      args: [],
      description: 'List stacks',
    },
  );

  commands.register(
    'stack',
    wrap(async (ctx, args) => {
      const stack = await portainer.getStack(args[0]);
      if (!stack) return reply(ctx, 'Stack not found.');
      await reply(ctx, JSON.stringify(stack, null, 2));
    }),
    {
      name: 'stack',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack details',
    },
  );

  commands.register(
    'start',
    wrap(async (ctx, args) => {
      const stack = await portainer.getStack(args[0]);
      if (!stack) return reply(ctx, 'Stack not found.');
      await portainer.startStack(stack);
      await emoji(ctx, '👍');
    }),
    {
      name: 'start',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Start stack',
    },
  );

  commands.register(
    'stop',
    wrap(async (ctx, args) => {
      const stack = await portainer.getStack(args[0]);
      if (!stack) return reply(ctx, 'Stack not found.');
      await portainer.stopStack(stack);
      await emoji(ctx, '👍');
    }),
    {
      name: 'stop',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Stop stack',
    },
  );

  commands.register(
    'status',
    wrap(async (ctx, args) => {
      let stackName;
      if (!args[0]) {
        stackName = env.STACK_NAME;
      } else {
        stackName = args[0];
      }

      const stack = await portainer.getStack(stackName);
      if (!stack) return reply(ctx, 'Stack not found.');
      const status = stack.Status === 1 ? '[✅ Up]' : '[❌ Down]';
      const imgStatus = await portainer.getImageStatus(stack);
      const imgMsg = imgStatus === 'updated' ? 'Images are up to date.' : 'Images are outdated.';
      await reply(ctx, `Stack: ${stack.Name} (stack: ${stack.Id}) ${status}\n${imgMsg}`);
    }),
    {
      name: 'status',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack status',
    },
  );

  commands.register(
    'redeploy',
    wrap(async (ctx, args) => {
      await emoji(ctx, '🔄');
      const stack = await portainer.getStack(args[0]);
      if (!stack) return reply(ctx, 'Stack not found.');
      await portainer.redeployStack(stack);
      await emoji(ctx, '✅');
    }),
    {
      name: 'redeploy',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Redeploy stack',
    },
  );

  commands.register(
    'restart',
    wrap(async (ctx, args) => {
      await emoji(ctx, '🔄');
      const stack = await portainer.getStack(args[0]);
      if (!stack) {
        await reply(ctx, 'Stack not found.');
        return;
      }
      void portainer.stopStack(stack).then(() => {
        setTimeout(() => {
          portainer
            .startStack(stack)
            .then(() => emoji(ctx, '✅'))
            .catch((e) => logger.error(e));
        }, 1000);
      });
    }),
    {
      name: 'restart',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Restart stack (without redeploying)',
    },
  );

  commands.register(
    'outdated',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    wrap(async (ctx, args) => {
      await emoji(ctx, '🔄');
      const stacks = await portainer.listStacks();
      const outdated = stacks.filter((stack) => stack.Status === 1);
      const results: { stack: Stack; status: string }[] = [];
      const promises = outdated.map(async (stack) => {
        const status = await portainer.getImageStatus(stack);
        results.push({ stack, status });
      });

      await Promise.all(promises);
      const msg = results
        .filter((r) => r.status === 'outdated')
        .map((r) => `• ${r.stack.Name} (stack: ${r.stack.Id})`)
        .join('\n');
      await reply(ctx, `Stacks with outdated images:\n${msg}`);
      await emoji(ctx, '✅');
    }),
    {
      name: 'outdated',
      args: [],
      description: 'List stacks with outdated images',
    },
  );

  const prepareReaction = async (ctx: SignalMessage, reaction: string) => {
    const recipient = ctx.group || ctx.account;
    const targetAuthor = ctx.rawMessage.envelope.source;
    const timestamp = ctx.rawMessage.envelope.timestamp;
    const r = {
      reaction,
      recipient,
      target_author: targetAuthor,
      timestamp,
    };
    const saved = {
      r,
      account: ctx.account,
    };
    await fs.writeFile(UPDATE_REQUEST_MESSAGE, JSON.stringify(saved, null, 2));
  };

  commands.register(
    'update',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    wrap(async (ctx, args) => {
      await emoji(ctx, '🔄');
      await prepareReaction(ctx, '👋');
      const stack = await portainer.getStack(env.STACK_NAME);
      if (!stack) return reply(ctx, 'Stack not found, has the env var STACK_NAME been set?');

      const status = await portainer.getImageStatus(stack);
      if (status === 'updated') {
        await emoji(ctx, '➖');
        return;
      }

      await portainer.redeployStack(stack);
      await emoji(ctx, '✅');
    }),
    {
      name: 'update',
      args: [],
      description: 'Alias for `redeploy signal` to update this bot',
    },
  );
}
