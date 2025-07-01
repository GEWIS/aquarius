import fs from 'fs/promises';
import { Commands } from './commands';
import { SignalMessage } from './message';
import { emoji, reply } from './signal';

export class TrustedNumbers {
  private readonly filePath: string;
  private trusted: Set<string> = new Set();
  loaded = false;

  constructor(filePath = '/home/.local/share/aquarius/trusted.json') {
    this.filePath = filePath;
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const arr: string[] = JSON.parse(data);
      this.trusted = new Set(arr);
      console.log('Trusted uuids loaded:', this.trusted);
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
      console.error('Error executing command:', e);
      await reply(ctx, `Failed to execute command: ${e}`);
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
        args: [{ name: 'number', required: true, description: 'Phone number to trust' }],
        description: 'Trust a phone number',
      },
    );
    commands.register(
      'untrust',
      async (c: SignalMessage) => {
        await this.doCommand(c, this.untrust.bind(this));
      },
      {
        name: 'untrust',
        args: [{ name: 'number', required: true, description: 'Phone number to untrust' }],
        description: 'Untrust a phone number',
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
        description: 'List trusted phone numbers',
      },
    );
  }
}
