import { SudoSOS } from '../sudosos';
import { emoji, reply } from '../signal';
import { Commands } from './index';
import { ContainerWithProductsResponse, ProductResponse } from '@sudosos/sudosos-client';

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
        await reply(ctx, `Invalid arguments: ${args}.\n Usage: sudosos-pos-list [take] [skip]`);
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

  commands.register(
    'lint-fix',
    async (ctx, args) => {
      const userId = parseInt(args[0]);
      if (isNaN(userId)) {
        await emoji(ctx, '❌');
        await reply(ctx, `Invalid arguments: ${args[0]}\n. Usage: lint-fix [userId]`);
        return;
      }

      const user = await sudosos.getUserById(userId);
      if (!user) {
        await emoji(ctx, '❌');
        await reply(ctx, `User ${userId} not found`);
        return;
      }

      const pos = await sudosos.getPosById(1);
      let grimbergen: { c: ContainerWithProductsResponse; p: ProductResponse } | null = null;
      for (const container of pos.containers) {
        for (const product of container.products) {
          if (product.id === 51) {
            grimbergen = {
              c: container,
              p: product,
            };
            break;
          }
        }
      }
      if (!grimbergen) {
        await emoji(ctx, '❌');
        await reply(ctx, 'Could not find *Grimbergen Tripel*');
        return;
      }

      const t = await sudosos.makeTransaction(
        { id: pos.id, revision: pos.revision },
        { container: { id: grimbergen.c.id, revision: grimbergen.c.revision ?? 0 }, to: grimbergen.c.owner.id },
        { id: grimbergen.p.id, revision: grimbergen.p.revision },
        1,
        userId,
        grimbergen.p.priceInclVat.amount,
      );

      await emoji(ctx, '🍺');
      await reply(
        ctx,
        `Bought a *Grimbergen Tripel* for ${user.firstName} (${user.id}), total price: €${t.totalPriceInclVat.amount / 100}`,
      );
    },
    {
      name: 'lint-fix',
      args: [{ name: 'userId', required: true, description: 'User ID' }],
      description: 'Buys a *Grimbergen Tripel* for the user',
    },
  );
}
