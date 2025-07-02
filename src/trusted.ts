import fs from 'fs/promises';
import { Commands } from './commands';
import { SignalMessage } from './message';
import { emoji, reply } from './signal';
import { logger } from './index';

export class TrustedNumbers {
  private readonly filePath: string;
  private trusted: Set<string> = new Set();
  loaded = false;

  constructor(filePath = '/home/.local/share/aquarius/trusted.json') {
    this.filePath = filePath;
    void this.load();
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const arr: string[] = JSON.parse(data) as string[];
      logger.debug('Trusted uuids loaded:', arr);
      this.trusted = new Set(arr);
    } catch {
      this.trusted = new Set();
      await this.save();
    } finally {
      this.loaded = true;
    }
  }

  async save() {
    const arr = Array.from(this.trusted);
    await fs.writeFile(this.filePath, JSON.stringify(arr, null, 2), 'utf-8');
  }

  isTrusted(uuid: string | null): boolean {
    if (!uuid) return false;
    return this.trusted.has(uuid);
  }

  async trust(uuid: string | null) {
    if (!uuid) return;
    this.trusted.add(uuid);
    await this.save();
  }

  async untrust(uuid: string | null) {
    if (!uuid) return;
    this.trusted.delete(uuid);
    await this.save();
  }

  list(): string[] {
    return Array.from(this.trusted);
  }

  async doCommand(ctx: SignalMessage, command: (number: string | null) => Promise<void>) {
    try {
      const mentions = ctx.rawMessage.envelope.dataMessage.mentions;
      if (mentions) {
        for (const mention of mentions) {
          if (mention.uuid && mention.start !== 0) {
            await command(mention.uuid);
          }
        }
      }
      await emoji(ctx, '👍');
    } catch (e) {
      logger.error('Error executing command:', e);
      await reply(ctx, `Failed to execute command: ${String(e)}`);
    }
  }

  registerCommands(commands: Commands) {
    commands.register(
      'trust',
      async (c: SignalMessage) => {
        await this.doCommand(c, this.trust.bind(this));
      },
      {
        name: 'trust',
        args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to trust' }],
        description: 'Trust mentioned user(s)',
      },
    );
    commands.register(
      'untrust',
      async (c: SignalMessage) => {
        await this.doCommand(c, this.untrust.bind(this));
      },
      {
        name: 'untrust',
        args: [{ name: 'mention(s)', required: true, description: 'Mentioned user(s) to untrust' }],
        description: 'Untrust mentioned user(s)',
      },
    );
    commands.register(
      'list',
      async (c: SignalMessage) => {
        await reply(c, `Trusted:\n ${this.list().join('\n')}`);
      },
      {
        name: 'list',
        args: [],
        description: 'List trusted uuids',
      },
    );
  }
}
