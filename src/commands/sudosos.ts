import {
  ContainerWithProductsResponse,
  PointOfSaleWithContainersResponse,
  ProductResponse,
  UserResponse,
} from '@sudosos/sudosos-client';
import { SudoSOS } from '../sudosos';
import { emoji, reply } from '../signal';
import { SignalMessage } from '../message';
import { logger } from '../index';
import { Users } from '../users';
import { isABC, isGuest } from './policy';
import { CommandContext, CommandHandler, Commands } from './index';

export function withExpandedArgs(users: Users, handler: CommandHandler): CommandHandler {
  return async (ctx: CommandContext) => {
    const args = parseArgsWithMentions(ctx, users);
    const user = users.getUser(ctx.msg.rawMessage.envelope.sourceUuid);

    logger.debug('Expanded args:', args, 'Caller ID:', ctx.msg.rawMessage.envelope.sourceUuid);
    await handler({
      ...ctx,
      args,
      user: user,
    });
  };
}

export function parseArgsWithMentions(ctx: CommandContext, users: Users): string[] {
  let message = ctx.msg.rawMessage.envelope.dataMessage.message;
  const mentions = ctx.msg.rawMessage.envelope.dataMessage.mentions ?? [];

  // Replace mentions (skip bot)
  const sorted = [...mentions].sort((a, b) => b.start - a.start);
  for (const mention of sorted) {
    const start = mention.start;
    const end = mention.start + mention.length;

    if (mention.start === 0) {
      message = message.slice(0, start) + message.slice(end);
    } else {
      const userId = users.getUser(mention.uuid)?.sudosId;
      if (userId != null) {
        message = message.slice(0, start) + String(userId) + message.slice(end);
      }
    }
  }

  const tokens = message.trim().split(/\s+/);
  tokens.shift();
  return tokens;
}

export function registerSudoSOSCommands(commands: Commands, sudosos: SudoSOS, users: Users) {
  commands.register({
    description: {
      name: 'sudosos',
      args: [],
      description: 'Show SudoSOS status',
    },
    handler: async (ctx: CommandContext) => {
      const status = await sudosos.getStatus();
      const emoji = status.maintenanceMode ? '🚫' : '✅';
      await reply(
        ctx.msg,
        `[${emoji}] **SudoSOS**\n ${status.maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled'}`,
      );
    },
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'maintenance',
      args: [{ name: 'enable', required: true, description: 'Enable maintenance mode' }],
      description: 'Toggle SudoSOS maintenance mode',
    },
    handler: async (ctx: CommandContext) => {
      await emoji(ctx.msg, '🔄');
      const enable = ctx.args[0].toLowerCase() === 'true';

      const status = await sudosos.getStatus();
      if (status.maintenanceMode === enable) {
        await emoji(ctx.msg, '✅');
        return;
      }

      await sudosos.setMaintenanceMode(enable);
      await emoji(ctx.msg, '✅');
    },
    policy: isABC || isABC,
  });

  commands.register({
    description: {
      name: 'sudosos-pos-list',
      args: [
        { name: 'take', required: false, description: 'Number of records to take' },
        { name: 'skip', required: false, description: 'Number of records to skip' },
      ],
      description: 'List all Points of sale',
    },
    handler: async (ctx: CommandContext) => {
      const [take, skip] = ctx.args.map((s) => parseInt(s));
      if (isNaN(take) || isNaN(skip)) {
        await reply(
          ctx.msg,
          `Invalid arguments: ${ctx.args.map((a) => a.toString()).join(' ')}.\n Usage: sudosos-pos-list [take] [skip]`,
        );
        return;
      }

      const { _pagination, records } = await sudosos.getPos(take, skip);
      const msg = records.map((p) => `• *${p.name}* (${p.id})`).join('\n');
      // const msg = pos.data.map((p) => `• ${p.name} (${p.id})`).join('\n');
      await reply(ctx.msg, `Points of sale (${_pagination.skip}, ${_pagination.take}/${_pagination.count}}):\n${msg}`);
    },
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'sudosos-pos',
      args: [{ name: 'id', required: true, description: 'Point of sale ID' }],
      description: 'Get Point of sale details',
    },
    handler: async (ctx: CommandContext) => {
      const id = parseInt(ctx.args[0]);
      if (isNaN(id)) {
        await reply(ctx.msg, 'Invalid arguments. Usage: sudosos-pos [id]');
        return;
      }

      const pos = await sudosos.getPosById(id);
      const products = [];
      const seen = new Set();
      for (const container of pos.containers) {
        for (const product of container.products) {
          if (!seen.has({ id: product.id, revision: product.revision })) {
            products.push(product);
            seen.add({ id: product.id, revision: product.revision });
          }
        }
      }

      const msg = products.map((p) => `• *${p.name}* (${p.id})`).join('\n');
      await reply(ctx.msg, `Point of sale ${pos.name} (${pos.id}):\n${msg}`);
    },
    policy: isGuest,
  });

  async function buyProduct(
    msg: SignalMessage,
    pos: PointOfSaleWithContainersResponse,
    productId: number,
    userId: number,
    times: number = 1,
  ) {
    const user = await sudosos.getUserById(userId);
    if (!user) {
      await emoji(msg, '❌');
      await reply(msg, `User ${userId} not found`);
      return;
    }

    let p: { c: ContainerWithProductsResponse; p: ProductResponse } | null = null;
    for (const container of pos.containers) {
      for (const product of container.products) {
        if (product.id === productId) {
          p = {
            c: container,
            p: product,
          };
          break;
        }
      }
    }

    if (!p) {
      await emoji(msg, '❌');
      await reply(msg, `Product ${productId} not found`);
      return;
    }

    const t = await sudosos.makeTransaction(
      { id: pos.id, revision: pos.revision },
      { container: { id: p.c.id, revision: p.c.revision ?? 0 }, to: p.c.owner.id },
      { id: p.p.id, revision: p.p.revision },
      times,
      userId,
      p.p.priceInclVat.amount,
    );

    const amount = times !== 1 ? times : 'a';
    await emoji(msg, '🍺');
    await reply(
      msg,
      `[🍺] Bought ${amount} *${p.p.name}* for ${user.firstName} (${user.id}), total price: €${t.totalPriceInclVat.amount / 100}`,
    );
  }

  const PRODUCTS_GRIMBERGEN = 51;
  const PRODUCTS_VIPER = 468;
  const PRODUCTS_METER = 80;
  const PRODUCTS_AQUARIUS = 244;

  async function getUser(ctx: CommandContext, arg: string): Promise<UserResponse | null> {
    const parsed = parseInt(arg);
    if (!isNaN(parsed)) {
      return await sudosos.getUserById(parsed).catch(() => null);
    }

    const callerId = users.getUser(ctx.msg.rawMessage.envelope.sourceUuid)?.sudosId ?? null;
    if (!callerId) return null;

    const user = await sudosos.getUserById(callerId).catch(() => null);
    if (!user) return null;

    return user;
  }

  const buy = async (ctx: CommandContext, productId: number, posId: number, userArg?: number, amountArg?: number) => {
    await emoji(ctx.msg, '🔄');

    let amount = 1;
    if (amountArg !== undefined) {
      const fromArg = parseInt(ctx.args[amountArg]);
      if (isNaN(fromArg)) {
        await reply(ctx.msg, `Invalid amount: ${ctx.args[amountArg]}`);
        return;
      }
      amount = fromArg;
    }

    const arg = userArg !== undefined ? ctx.args[userArg] : '';
    const user = await getUser(ctx, arg);
    if (!user) {
      await emoji(ctx.msg, '❌');
      await reply(ctx.msg, `Missing or invalid user ID.\nUsage: lint-fix [userId]`);
      return;
    }

    const pos = await sudosos.getPosById(posId);
    await buyProduct(ctx.msg, pos, productId, user.id, amount);
  };

  commands.register({
    description: {
      name: 'lint-fix',
      args: [{ name: 'userId', required: false, description: 'User ID (optional if linked)' }],
      description: 'Buys a *Grimbergen Tripel* for the user',
    },
    handler: withExpandedArgs(users, async (ctx: CommandContext) => {
      await buy(ctx, PRODUCTS_GRIMBERGEN, 1, 0);
    }),
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'classic',
      args: [
        { name: 'amount', required: true, description: 'Amount to buy' },
        { name: 'userId', required: false, description: 'User ID (optional if linked)' },
      ],
      description: 'Buys a *Classic* for the user',
    },
    handler: withExpandedArgs(users, async (ctx: CommandContext) => {
      await buy(ctx, PRODUCTS_VIPER, 1, 1, 0);
    }),
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'meter',
      args: [{ name: 'userId', required: false, description: 'User ID (optional if linked)' }],
      description: 'Zo kom je een *meter* verder',
    },
    handler: withExpandedArgs(users, async (ctx: CommandContext) => {
      await buy(ctx, PRODUCTS_METER, 2, 0);
    }),
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'brak',
      args: [{ name: 'userId', required: false, description: 'User ID (optional if linked)' }],
      description: '**Auw**',
    },
    handler: withExpandedArgs(users, async (ctx: CommandContext) => {
      await buy(ctx, PRODUCTS_AQUARIUS, 1, 0);
    }),
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'balance',
      args: [],
      description: 'Show your own balance',
    },
    handler: withExpandedArgs(users, async (ctx: CommandContext) => {
      const user = await getUser(ctx, ctx.args[0]);
      if (!user) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, `Missing or invalid user ID.\nUsage: lint-fix [userId]`);
        return;
      }

      const balance = await sudosos.getBalance(user.id);
      await emoji(ctx.msg, '💰');
      await reply(ctx.msg, `[💰] ${user.firstName} (${user.id}) has €${balance.amount.amount / 100}`);
    }),
    policy: isGuest,
  });
}
