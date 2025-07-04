import assert from 'node:assert';
import {
  ContainerWithProductsResponse,
  PointOfSaleWithContainersResponse,
  ProductResponse,
} from '@sudosos/sudosos-client';
import { ModuleApi } from '../../core/module-api';
import { CommandContext } from '../../commands';
import { env } from '../../env';
import { isABC, isGuest } from '../../commands/policy';
import { logger } from '../../core/logger';
import { SignalMessage } from '../../core/message';
import { emoji, reply } from '../signal/signal';
import { StoredUser } from '../users/users';
import { SudoSOS } from './sudosos';

const PRODUCTS_GRIMBERGEN = 51;
const PRODUCTS_VIPER = 468;
const PRODUCTS_METER = 80;
const PRODUCT_LEREN = 75;
const PRODUCTS_AQUARIUS = 244;

function formatEuro(n: number): string {
  return (n / 100).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });
}

export function registerSudoSOSModule(api: ModuleApi) {
  const { commands, users } = api;

  const { SUDOSOS_API_URL, SUDOSOS_API_KEY, SUDOSOS_USER_ID } = env;
  if (SUDOSOS_API_URL === '' || SUDOSOS_API_KEY === '' || SUDOSOS_USER_ID === '') {
    logger.warn('SudoSOS API URL, API key or user ID not set. Skipping SudoSOS integration.');
  }

  const sudosos = new SudoSOS(SUDOSOS_API_URL);
  logger.info('SudoSOS initialized');

  const buyProduct = async (
    msg: SignalMessage,
    pos: PointOfSaleWithContainersResponse,
    productId: number,
    userId: number,
    times: number = 1,
  ) => {
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
  };

  const buy = async (ctx: CommandContext, productId: number, posId: number, amount: number, user: StoredUser) => {
    await emoji(ctx.msg, '🔄');

    if (!user.sudosId) {
      await emoji(ctx.msg, '❌');
      await reply(ctx.msg, `SudoSOS user ID missing.\nsee *help link* to link your SudoSOS account.`);
      return;
    }

    const pos = await sudosos.getPosById(posId);
    await buyProduct(ctx.msg, pos, productId, user.sudosId, amount);
  };

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

  commands.registerTyped({
    description: {
      name: 'sudosos-pos-list',
      args: [
        { name: 'take', required: false, description: 'Number of records to take', type: 'number' },
        { name: 'skip', required: false, description: 'Number of records to skip', type: 'number' },
      ] as const,
      description: 'List all Points of sale',
      aliases: ['pos-list', 'posl', 'pl'],
    },
    handler: async (ctx) => {
      const [take, skip] = ctx.parsedArgs;

      const t = take ?? 10;
      const s = skip ?? 0;

      const { _pagination, records } = await sudosos.getPos(t, s);
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
      aliases: ['pos', 'p'],
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

  commands.registerTyped({
    description: {
      name: 'buy',
      args: [
        { name: 'productId', required: true, description: 'Product ID to buy', type: 'number' },
        { name: 'posId', required: true, description: 'Point of Sale ID', type: 'number' },
        { name: 'amount', required: false, description: 'Amount (default: 1)', type: 'number' },
        { name: 'user', required: false, description: 'User ID (optional if linked)', type: 'user-optional' },
      ] as const,
      description: 'Buy any product for any user at any POS',
    },
    handler: async (ctx) => {
      const [productId, posId, amount, user] = ctx.parsedArgs;
      await buy(ctx, productId, posId, amount, user);
    },
    policy: isGuest,
  });

  // --- Aliases with Custom Descriptions ---

  commands.registerTyped({
    description: {
      name: 'lint-fix',
      args: [
        { name: 'user', required: false, description: 'User ID (optional if linked)', type: 'user-optional' },
      ] as const,
      description: 'Buys a *Grimbergen Tripel* for the user',
    },
    handler: async (ctx) => {
      const [user] = ctx.parsedArgs;
      await buy(ctx, PRODUCTS_GRIMBERGEN, 1, 1, user);
    },
    policy: isGuest,
  });

  commands.registerTyped({
    description: {
      name: 'classic',
      args: [
        { name: 'amount', required: true, description: 'Amount to buy', type: 'number' },
        { name: 'userId', required: false, description: 'User ID (optional if linked)', type: 'user-optional' },
      ] as const,
      description: 'Buys a *Classic* for the user',
    },
    handler: async (ctx) => {
      const [amount, user] = ctx.parsedArgs;
      await buy(ctx, PRODUCTS_VIPER, 1, amount, user);
    },
    policy: isGuest,
  });

  commands.registerTyped({
    description: {
      name: 'meter',
      args: [
        { name: 'userId', required: false, description: 'User ID (optional if linked)', type: 'user-optional' },
      ] as const,
      description: 'Zo kom je een *meter* verder',
    },
    handler: async (ctx) => {
      const [user] = ctx.parsedArgs;
      await buy(ctx, PRODUCTS_METER, 10, 1, user);
    },
    policy: isGuest,
  });

  commands.registerTyped({
    description: {
      name: 'brak',
      args: [
        { name: 'userId', required: false, description: 'User ID (optional if linked)', type: 'user-optional' },
      ] as const,
      description: '**Auw**',
    },
    handler: async (ctx) => {
      logger.debug('Brak command', ctx.parsedArgs, ctx.args);
      const [user] = ctx.parsedArgs;
      await buy(ctx, PRODUCTS_AQUARIUS, 1, 1, user);
    },
    policy: isGuest,
  });

  const getUser = (ctx: CommandContext) => {
    const callerId = ctx.msg.rawMessage.envelope.sourceUuid;
    const user = users.getUser(callerId);
    assert(user, 'User not found');
    return user;
  };

  commands.register({
    description: {
      name: 'balance',
      args: [],
      description: 'Show your own balance',
    },
    handler: async (ctx) => {
      const user = getUser(ctx);

      if (!user.sudosId) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, `SudoSOS user ID missing.\nsee *help link* to link your SudoSOS account.`);
        return;
      }

      const sudososUser = await sudosos.getUserById(user.sudosId);
      if (!sudososUser) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, `SudoSOS user ID ${user.sudosId} not found.`);
        return;
      }

      const balance = await sudosos.getBalance(user.sudosId);
      await emoji(ctx.msg, '💰');
      await reply(
        ctx.msg,
        `[💰] ${sudososUser.firstName} (${sudososUser.id}) has ${formatEuro(balance.amount.amount)}`,
      );
    },
    policy: isGuest,
  });

  commands.registerTyped({
    description: {
      name: 'leren',
      args: [
        { name: 'user', required: false, description: 'User that is learning', type: 'user-optional', rest: false },
      ] as const,
      description: 'Leren',
    },
    handler: async (ctx) => {
      const [user] = ctx.parsedArgs;
      await buy(ctx, PRODUCT_LEREN, 10, 1, user);
    },
    policy: isGuest,
  });

  commands.registerTyped({
    description: {
      name: 'total',
      args: [],
      description: 'Information about your total expenses',
    },
    handler: async (ctx) => {
      const user = getUser(ctx);

      if (!user.sudosId) {
        await emoji(ctx.msg, '❌');
        await reply(ctx.msg, `SudoSOS user ID missing.\nsee *help link* to link your SudoSOS account.`);
        return;
      }

      await emoji(ctx.msg, '🔄');
      const report = await sudosos.getReport(user.sudosId);

      await emoji(ctx.msg, '💰');
      const totalExpenses = report.totalInclVat.amount;

      await reply(ctx.msg, `[💰] You have spent a total of ${formatEuro(totalExpenses)}`);
    },
    policy: isGuest,
  });

  const leren = async (msg: SignalMessage) => {
    const raw = msg.rawMessage.envelope.dataMessage.message;
    const regexLeer = /l+e{2,}r+/i;
    const regexLeren = /l+e+r+e+n+/i;

    if (!(regexLeer.test(raw) || regexLeren.test(raw))) return;

    const learnCommand = commands.getCommand('leren');
    assert(learnCommand, 'leren command not found');

    await reply(msg, 'LEEEEERREEEEEN?????');
    const user = users.getUser(msg.rawMessage.envelope.sourceUuid);
    // silent fail
    if (!user || !user.sudosId) return;

    await learnCommand.handler({
      msg,
      command: learnCommand,
      args: [],
      callerId: msg.rawMessage.envelope.sourceUuid,
      user: undefined,
    });
    await emoji(msg, '😋');
  };

  return {
    leren,
  };
}
