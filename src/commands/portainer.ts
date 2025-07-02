import fs from 'fs/promises';
import { Commands, CommandHandler, CommandContext } from '../commands';
import { reply, emoji } from '../signal';
import { Portainer } from '../portainer';
import { Stack } from '../portainer.types';
import { SignalMessage } from '../message';
import { logger, UPDATE_REQUEST_MESSAGE } from '../index';
import { env } from '../env';

export function registerPortainerCommands(commands: Commands, portainer: Portainer) {
  const wrap = (fn: CommandHandler): CommandHandler => fn;

  commands.register({
    description: {
      name: 'stacks',
      args: [],
      description: 'List stacks',
      aliases: ['stack-list'],
    },
    handler: wrap(async (ctx: CommandContext) => {
      const stacks = await portainer.listStacks();
      if (stacks.length === 0) return reply(ctx.msg, 'No stacks found.');
      const msg = stacks.map((s) => `• ${s.Name} (stack: ${s.Id})`).join('\n');
      await reply(ctx.msg, `Stacks:\n${msg}`);
    }),
  });

  commands.register({
    description: {
      name: 'stack',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack details',
    },
    handler: wrap(async (ctx: CommandContext) => {
      const stack = await portainer.getStack(ctx.args[0]);
      if (!stack) return reply(ctx.msg, 'Stack not found.');
      await reply(ctx.msg, JSON.stringify(stack, null, 2));
    }),
  });

  commands.register({
    description: {
      name: 'start',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Start stack',
    },
    handler: wrap(async (ctx: CommandContext) => {
      const stack = await portainer.getStack(ctx.args[0]);
      if (!stack) return reply(ctx.msg, 'Stack not found.');
      await portainer.startStack(stack);
      await emoji(ctx.msg, '👍');
    }),
  });

  commands.register({
    description: {
      name: 'stop',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Stop stack',
    },
    handler: wrap(async (ctx: CommandContext) => {
      const stack = await portainer.getStack(ctx.args[0]);
      if (!stack) return reply(ctx.msg, 'Stack not found.');
      await portainer.stopStack(stack);
      await emoji(ctx.msg, '👍');
    }),
  });

  commands.register({
    description: {
      name: 'status',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack status',
    },
    handler: wrap(async (ctx: CommandContext) => {
      let stackName;
      if (!ctx.args[0]) {
        stackName = env.STACK_NAME;
      } else {
        stackName = ctx.args[0];
      }

      const stack = await portainer.getStack(stackName);
      if (!stack) return reply(ctx.msg, 'Stack not found.');
      const status = stack.Status === 1 ? '[✅ Up]' : '[❌ Down]';
      const imgStatus = await portainer.getImageStatus(stack);
      const imgMsg = imgStatus === 'updated' ? 'Images are up to date.' : 'Images are outdated.';
      await reply(ctx.msg, `Stack: ${stack.Name} (stack: ${stack.Id}) ${status}\n${imgMsg}`);
    }),
  });

  commands.register({
    description: {
      name: 'redeploy',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Redeploy stack',
    },
    handler: wrap(async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
      const stack = await portainer.getStack(ctx.args[0]);
      if (!stack) return reply(ctx.msg, 'Stack not found.');
      await portainer.redeployStack(stack);
      await emoji(ctx.msg, '✅');
    }),
  });

  commands.register({
    description: {
      name: 'restart',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Restart stack (without redeploying)',
    },
    handler: wrap(async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
      const stack = await portainer.getStack(ctx.args[0]);
      if (!stack) {
        await reply(ctx.msg, 'Stack not found.');
        return;
      }
      void portainer.stopStack(stack).then(() => {
        setTimeout(() => {
          portainer
            .startStack(stack)
            .then(() => emoji(ctx.msg, '✅'))
            .catch((e) => logger.error(e));
        }, 1000);
      });
    }),
  });

  commands.register({
    description: {
      name: 'outdated',
      args: [],
      description: 'List stacks with outdated images',
    },
    handler: wrap(async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
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
      await reply(ctx.msg, `Stacks with outdated images:\n${msg}`);
      await emoji(ctx.msg, '✅');
    }),
  });

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

  commands.register({
    description: {
      name: 'update',
      args: [],
      description: 'Alias for `redeploy signal` to update this bot',
      aliases: ['u'],
    },
    handler: wrap(async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
      await prepareReaction(ctx.msg, '👋');
      const stack = await portainer.getStack(env.STACK_NAME);
      if (!stack) return reply(ctx.msg, 'Stack not found, has the env var STACK_NAME been set?');

      const status = await portainer.getImageStatus(stack);
      if (status === 'updated') {
        await emoji(ctx.msg, '➖');
        return;
      }

      await portainer.redeployStack(stack);
      await emoji(ctx.msg, '✅');
    }),
  });
}
