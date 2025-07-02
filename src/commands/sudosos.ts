import {
  ContainerWithProductsResponse,
  PointOfSaleWithContainersResponse,
  ProductResponse,
} from '@sudosos/sudosos-client';
import { SudoSOS } from '../sudosos';
import { emoji, reply } from '../signal';
import { SignalMessage } from '../message';
import { Commands } from './index';

export function registerSudoSOSCommands(commands: Commands, sudosos: SudoSOS) {
  commands.register(
    'sudosos',
    async (ctx) => {
      const status = await sudosos.getStatus();
      const emoji = status.maintenanceMode ? '🚫' : '✅';
      await reply(
        ctx,
        `[${emoji}] **SudoSOS**\n ${status.maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled'}`,
      );
    },
    {
      name: 'sudosos',
      args: [],
      description: 'Show SudoSOS status',
    },
  );

  commands.register(
    'maintenance',
    async (ctx, args) => {
      await emoji(ctx, '🔄');
      const enable = args[0].toLowerCase() === 'true';

      const status = await sudosos.getStatus();
      if (status.maintenanceMode === enable) {
        await emoji(ctx, '✅');
        return;
      }

      await sudosos.setMaintenanceMode(enable);
      await emoji(ctx, '✅');
    },
    {
      name: 'maintenance',
      args: [{ name: 'enable', required: true, description: 'Enable maintenance mode' }],
      description: 'Toggle SudoSOS maintenance mode',
    },
  );

  commands.register(
    'sudosos-pos-list',
    async (ctx, args) => {
      const [take, skip] = args.map((s) => parseInt(s));
      if (isNaN(take) || isNaN(skip)) {
        await reply(
          ctx,
          `Invalid arguments: ${args.map((a) => a.toString()).join(' ')}.\n Usage: sudosos-pos-list [take] [skip]`,
        );
        return;
      }

      const { _pagination, records } = await sudosos.getPos(take, skip);
      const msg = records.map((p) => `• *${p.name}* (${p.id})`).join('\n');
      // const msg = pos.data.map((p) => `• ${p.name} (${p.id})`).join('\n');
      await reply(ctx, `Points of sale (${_pagination.skip}, ${_pagination.take}/${_pagination.count}}):\n${msg}`);
    },
    {
      name: 'sudosos-pos-list',
      args: [
        { name: 'take', required: false, description: 'Number of records to take' },
        { name: 'skip', required: false, description: 'Number of records to skip' },
      ],
      description: 'List all Points of sale',
    },
  );

  commands.register(
    'sudosos-pos',
    async (ctx, args) => {
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        await reply(ctx, 'Invalid arguments. Usage: sudosos-pos [id]');
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

      await reply(ctx, `Point of sale ${pos.name} (${pos.id}):\n${msg}`);
    },
    {
      name: 'sudosos-pos',
      args: [{ name: 'id', required: true, description: 'Point of sale ID' }],
      description: 'Get Point of sale details',
    },
  );

  async function buyProduct(
    ctx: SignalMessage,
    pos: PointOfSaleWithContainersResponse,
    productId: number,
    userId: number,
    times: number = 1,
  ) {
    const user = await sudosos.getUserById(userId);
    if (!user) {
      await emoji(ctx, '❌');
      await reply(ctx, `User ${userId} not found`);
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
      await emoji(ctx, '❌');
      await reply(ctx, `Product ${productId} not found`);
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
    await emoji(ctx, '🍺');
    await reply(
      ctx,
      `[🍺] Bought ${amount} *${p.p.name}* for ${user.firstName} (${user.id}), total price: €${t.totalPriceInclVat.amount / 100}`,
    );
  }

  const PRODUCTS_GRIMBERGEN = 51;
  const PRODUCTS_VIPER = 468;
  const PRODUCTS_METER = 80;
  const PRODUCTS_AQUARIUS = 244;

  commands.register(
    'lint-fix',
    async (ctx, args) => {
      await emoji(ctx, '🔄');
      const userId = parseInt(args[0]);
      if (isNaN(userId)) {
        await emoji(ctx, '❌');
        await reply(ctx, `Invalid arguments: ${args[0]}\n. Usage: lint-fix [userId]`);
        return;
      }
      const pos = await sudosos.getPosById(1);
      await buyProduct(ctx, pos, PRODUCTS_GRIMBERGEN, userId);
    },
    {
      name: 'lint-fix',
      args: [{ name: 'userId', required: true, description: 'User ID' }],
      description: 'Buys a *Grimbergen Tripel* for the user',
    },
  );

  commands.register(
    'classic',
    async (ctx, args) => {
      await emoji(ctx, '🔄');
      const userId = parseInt(args[0]);
      const amount = parseInt(args[1]);
      if (isNaN(userId) || isNaN(amount)) {
        await emoji(ctx, '❌');
        await reply(ctx, `Invalid arguments: ${args[0]}\n. Usage: classic [userId] [amount]`);
        return;
      }
      const pos = await sudosos.getPosById(1);
      await buyProduct(ctx, pos, PRODUCTS_VIPER, userId, amount);
    },
    {
      name: 'classic',
      args: [
        { name: 'userId', required: true, description: 'User ID' },
        { name: 'amount', required: true, description: 'Amount to buy' },
      ],
      description: 'Buys a *Classic* for the user',
    },
  );

  commands.register(
    'meter',
    async (ctx, args) => {
      await emoji(ctx, '🔄');
      const userId = parseInt(args[0]);
      if (isNaN(userId)) {
        await emoji(ctx, '❌');
        await reply(ctx, `Invalid arguments: ${args[0]}\n. Usage: meter [userId]`);
        return;
      }
      const pos = await sudosos.getPosById(2);
      await buyProduct(ctx, pos, PRODUCTS_METER, userId, 1);
    },
    {
      name: 'meter',
      args: [{ name: 'userId', required: true, description: 'User ID' }],
      description: 'Zo kom je een *meter* verder',
    },
  );

  commands.register(
    'brak',
    async (ctx, args) => {
      await emoji(ctx, '🔄');
      const userId = parseInt(args[0]);
      if (isNaN(userId)) {
        await emoji(ctx, '❌');
        await reply(ctx, `Invalid arguments: ${args[0]}\n. Usage: brak [userId]`);
        return;
      }
      const pos = await sudosos.getPosById(1);
      await buyProduct(ctx, pos, PRODUCTS_AQUARIUS, userId, 1);
    },
    {
      name: 'brak',
      args: [{ name: 'userId', required: true, description: 'User ID' }],
      description: '**Auw**',
    },
  );
}
