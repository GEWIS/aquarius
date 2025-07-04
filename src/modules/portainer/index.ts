import fs from 'fs/promises';
import { CommandContext, CommandHandler } from '../../commands';
import { isCBC } from '../../commands/policy';
import { env } from '../../env';
import { logger } from '../../core/logger';
import { ModuleApi } from '../../core/module-api';
import { emoji, reply } from '../signal/signal';
import { SignalMessage } from '../../core/message';
import { UPDATE_REQUEST_MESSAGE } from '../signal';
import { Portainer } from './portainer';
import { Stack } from './portainer.types';

export function registerPortainerModule(api: ModuleApi) {
  const { commands } = api;

  const { PORTAINER_URL, PORTAINER_API_KEY } = env;
  if (PORTAINER_URL === '' || PORTAINER_API_KEY === '') {
    logger.warn('Portainer URL or API key not set. Skipping Portainer integration.');
  }
  const portainer = new Portainer(PORTAINER_URL, PORTAINER_API_KEY);

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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
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
    policy: isCBC,
  });

  commands.register({
    description: {
      name: 'repull',
      args: [],
      description: 'Pull the latest version of the stack',
      aliases: ['r'],
    },
    handler: wrap(async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
      await prepareReaction(ctx.msg, '👋');
      const service = env.SERVICE_NAME;
      const stack = await portainer.getStack(env.STACK_NAME);

      if (!stack) return reply(ctx.msg, 'Stack not found, has the env var STACK_NAME been set?');
      if (!service) return reply(ctx.msg, 'Service not found, has the env var SERVICE_NAME been set?');

      await portainer.repullService(service, 5);
      await emoji(ctx.msg, '✅');
    }),
    policy: isCBC,
  });
}
