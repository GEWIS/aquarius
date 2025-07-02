import { Commands } from '../commands';
import { Users } from '../users';
import { SignalMessage } from '../message';
import { emoji, reply } from '../signal';
import { logger } from '../index';


export function registerUserCommands(commands: Commands, users: Users) {
  commands.register(
    'register',
    async (ctx: SignalMessage) => {
      await users.registerUser(ctx);
    },
    {
      name: 'register',
      args: [],
      description: 'Register yourself as a known user',
      open: true,
    },
  );

  commands.register(
    'trust',
    async (ctx: SignalMessage) => {
      const mentions = ctx.rawMessage.envelope.dataMessage.mentions ?? [];
      for (const mention of mentions) {
        if (mention.start !== 0 && users.getUser(mention.uuid)) {
          await users.trust(mention.uuid);
        }
      }
      await emoji(ctx, '✅');
    },
    {
      name: 'trust',
      args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to trust' }],
      description: 'Trust mentioned registered users',
    },
  );

  commands.register(
    'untrust',
    async (ctx: SignalMessage) => {
      const mentions = ctx.rawMessage.envelope.dataMessage.mentions ?? [];
      for (const mention of mentions) {
        if (mention.start !== 0 && users.getUser(mention.uuid)) {
          await users.untrust(mention.uuid);
        }
      }
      await emoji(ctx, '✅');
    },
    {
      name: 'untrust',
      args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to untrust' }],
      description: 'Untrust mentioned registered users',
    },
  );

  const linkCommand = async (ctx: SignalMessage, cb: (uuid: string, userId: number) => Promise<void>) => {
    try {
      const mentions = ctx.rawMessage.envelope.dataMessage.mentions;

      const tokens = ctx.rawMessage.envelope.dataMessage.message.trim().split(/\s+/);
      const userIdStr = tokens[tokens.length - 1];
      const userId = Number(userIdStr);

      if (!userId || isNaN(userId)) {
        await reply(ctx, 'Missing or invalid Sudosos user ID.');
        return;
      }

      if (!mentions || mentions.length !== 2) {
        await reply(ctx, 'You must mention exactly one user.');
        return;
      }

      const mention = mentions[1];
      if (mention.start === 0 || mention.uuid === ctx.account) {
        await reply(ctx, 'Mention must be a user.');
        return;
      }

      await cb(mention.uuid, userId);
      await emoji(ctx, '✅');
    } catch (e) {
      logger.error('Link command failed:', e);
      await reply(ctx, `Failed to link: ${String(e)}`);
    }
  };

  commands.register(
    'list',
    async (ctx: SignalMessage) => {
      const list = users.listTrusted();
      await reply(ctx, `Trusted:\n${list || '(none)'}`);
    },
    {
      name: 'linked',
      args: [],
      description: 'List all trusted registered users',
    },
  );

  commands.register(
    'link',
    async (c: SignalMessage) => {
      await linkCommand(c, async (uuid, userId) => {
        await users.link(uuid, userId);
      });
    },
    {
      name: 'link',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to link' }],
      description: 'Link mentioned Signal UUID to a SudoSOS user ID',
      open: true,
    },
  );

  commands.register(
    'self-link',
    async (c: SignalMessage, args: string[]) => {
      const userId = parseInt(args[0]);
      if (!userId || isNaN(userId)) {
        await reply(c, 'Missing or invalid SudoSOS user ID.');
        return;
      }
      const uuid = c.rawMessage.envelope.sourceUuid;
      await users.link(uuid, userId);
      await emoji(c, '✅');
    },
    {
      name: 'self-link',
      args: [{ name: 'userId', required: true, description: 'SudoSOS user ID' }],
      description: 'Link your own Signal UUID to a SudoSOS user ID',
      open: true,
    },
  );

  commands.register(
    'unlink',
    async (c: SignalMessage) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await linkCommand(c, async (uuid, userId) => {
        await users.unlink(uuid);
      });
    },
    {
      name: 'unlink',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to unlink' }],
      description: 'Unlink mentioned Signal UUID from SudoSOS user ID',
      open: true,
    },
  );
}
