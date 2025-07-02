import { CommandContext, Commands } from '../commands';
import { StoredUser, TEAMS, Users } from '../users';
import { SignalMessage } from '../message';
import { emoji, reply } from '../signal';
import { logger } from '../index';
import { isAdmin } from './policy';

export function registerUserCommands(commands: Commands, users: Users) {
  commands.register({
    description: {
      name: 'register',
      args: [],
      description: 'Register yourself as a known user',
    },
    handler: async (ctx: CommandContext) => {
      await users.registerUser(ctx.msg);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    policy: async (ctx: CommandContext) => {
      return Promise.resolve(true);
    },
    registered: false,
  });

  commands.register({
    description: {
      name: 'trust',
      args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to trust' }],
      description: 'Trust mentioned registered users',
    },
    handler: async (ctx: CommandContext) => {
      const mentions = ctx.msg.rawMessage.envelope.dataMessage.mentions ?? [];
      for (const mention of mentions) {
        if (mention.start !== 0 && users.getUser(mention.uuid)) {
          await users.trust(mention.uuid);
        }
      }
      await emoji(ctx.msg, '✅');
    },
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'untrust',
      args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to untrust' }],
      description: 'Untrust mentioned registered users',
    },
    handler: async (ctx: CommandContext) => {
      const mentions = ctx.msg.rawMessage.envelope.dataMessage.mentions ?? [];
      for (const mention of mentions) {
        if (mention.start !== 0 && users.getUser(mention.uuid)) {
          await users.untrust(mention.uuid);
        }
      }
      await emoji(ctx.msg, '✅');
    },
    policy: isAdmin,
  });

  const linkCommand = async (ctx: SignalMessage, cb: (uuid: string, arg: number) => Promise<void>) => {
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

  commands.register({
    description: {
      name: 'trusted',
      args: [],
      description: 'List all trusted registered users',
    },
    handler: async (ctx: CommandContext) => {
      const trusted = users.trusted();

      const getTeams = (u: StoredUser) => {
        if (!u.teams) return '';
        return Array.from(u.teams.values()).join(', ');
      };

      const list = trusted.map((u) => `${u.name}) [${getTeams(u)}] ${u.sudosId ? ` → ${u.sudosId}` : ''}`).join('\n');
      await reply(ctx.msg, `Trusted:\n${list || '(none)'}`);
    },
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'link',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to link' }],
      description: 'Link mentioned Signal UUID to a SudoSOS user ID',
    },
    handler: async (ctx: CommandContext) => {
      await linkCommand(ctx.msg, async (uuid, userId) => {
        await users.link(uuid, userId);
      });
    },
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'self-link',
      args: [{ name: 'userId', required: true, description: 'SudoSOS user ID' }],
      description: 'Link your own Signal UUID to a SudoSOS user ID',
    },
    handler: async (ctx: CommandContext) => {
      const userId = parseInt(ctx.args[0]);
      if (!userId || isNaN(userId)) {
        await reply(ctx.msg, 'Missing or invalid SudoSOS user ID.');
        return;
      }
      const uuid = ctx.msg.rawMessage.envelope.sourceUuid;
      await users.link(uuid, userId);
      await emoji(ctx.msg, '✅');
    },
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'unlink',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to unlink' }],
      description: 'Unlink mentioned Signal UUID from SudoSOS user ID',
    },
    handler: async (ctx: CommandContext) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await linkCommand(ctx.msg, async (uuid, userId) => {
        await users.unlink(uuid);
      });
    },
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'team-add',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to link' }],
      description: 'Link mentioned Signal UUID to a SudoSOS user ID',
    },
    policy: isAdmin,
    handler: async (ctx: CommandContext) => {
      await linkCommand(ctx.msg, async (uuid, teamId) => {
        if (teamId === undefined) {
          await reply(ctx.msg, 'Missing or invalid team ID.');
          return;
        }

        if (!Object.values(TEAMS).includes(teamId)) {
          await reply(ctx.msg, 'Invalid team ID.');
          return;
        }

        users.addTeam(uuid, teamId);
      });
    },
  });

  commands.register({
    description: {
      name: 'team-remove',
      args: [{ name: 'mention', required: true, description: 'Mentioned user to link' }],
      description: 'Link mentioned Signal UUID to a SudoSOS user ID',
    },
    policy: isAdmin,
    handler: async (ctx: CommandContext) => {
      await linkCommand(ctx.msg, async (uuid, teamId) => {
        if (teamId === undefined) {
          await reply(ctx.msg, 'Missing or invalid team ID.');
          return;
        }

        if (!Object.values(TEAMS).includes(teamId)) {
          await reply(ctx.msg, 'Invalid team ID.');
          return;
        }

        users.removeTeam(uuid, teamId);
      });
    },
  });
}
