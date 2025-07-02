import fs from 'fs/promises';
import { Commands } from './commands';
import { SignalMessage } from './message';
import { emoji, reply } from './signal';
import { logger } from './index';

export class LinkedUsers {
  private readonly filePath: string;
  private links: Map<string, number> = new Map();
  loaded = false;

  constructor(filePath = '/home/.local/share/aquarius/sudosos-links.json') {
    this.filePath = filePath;
    void this.load();
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const obj = JSON.parse(data) as Record<string, number>;
      this.links = new Map(Object.entries(obj));
      logger.debug('Linked users loaded:', obj);
    } catch {
      this.links = new Map();
      await this.save();
    } finally {
      this.loaded = true;
    }
  }

  async save() {
    const obj = Object.fromEntries(this.links);
    await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
  }

  async link(uuid: string | null, userId: number) {
    if (!uuid) return;
    this.links.set(uuid, userId);
    await this.save();
  }

  async unlink(uuid: string | null) {
    if (!uuid) return;
    this.links.delete(uuid);
    await this.save();
  }

  getLinkedUserId(uuid: string | null): number | null {
    if (!uuid) return null;
    return this.links.get(uuid) ?? null;
  }

  list(): string {
    return [...this.links.entries()].map(([uuid, userId]) => `${uuid} → ${userId}`).join('\n');
  }

  async doCommand(ctx: SignalMessage, cb: (uuid: string | null, userId: number) => Promise<void>) {
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
  }

  registerCommands(commands: Commands) {
    commands.register(
      'self-link',
      async (c: SignalMessage, args: string[]) => {
        const userId = parseInt(args[0]);
        if (!userId || isNaN(userId)) {
          await reply(c, 'Missing or invalid SudoSOS user ID.');
          return;
        }
        await this.link(c.rawMessage.envelope.sourceUuid, userId);
        await emoji(c, '✅');
      },
      {
        name: 'self-link',
        args: [{ name: 'userId', required: true, description: 'SudoSOS user ID' }],
        description: 'Link your own Signal UUID to a SudoSOS user ID',
      },
    );

    commands.register(
      'link',
      async (c: SignalMessage) => {
        await this.doCommand(c, this.link.bind(this));
      },
      {
        name: 'link',
        args: [
          { name: 'userId', required: true, description: 'SudoSOS user ID' },
          { name: 'mention', required: true, description: 'Mentioned user to link' },
        ],
        description: 'Link mentioned Signal UUID to a SudoSOS user ID',
      },
    );

    commands.register(
      'unlink',
      async (c: SignalMessage) => {
        const mentions = c.rawMessage.envelope.dataMessage.mentions;
        if (mentions) {
          for (const mention of mentions) {
            if (mention.uuid && mention.start !== 0) {
              await this.unlink(mention.uuid);
            }
          }
        }
        await emoji(c, '✅');
      },
      {
        name: 'unlink',
        args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to unlink' }],
        description: 'Unlink mentioned Signal UUIDs from SudoSOS user IDs',
      },
    );

    commands.register(
      'linked',
      async (c: SignalMessage) => {
        await reply(c, `Linked UUIDs:\n${this.list() || '(none)'}`);
      },
      {
        name: 'linked',
        args: [],
        description: 'List all linked Signal UUIDs and SudoSOS user IDs',
      },
    );
  }
}
