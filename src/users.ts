import fs from 'fs/promises';
import path from 'path';
import { SignalMessage } from './message';
import { emoji, reply } from './signal';
import { env } from './env';
import { logger } from './index';

interface StoredUser {
  uuid: string;
  name: string;
  number: string;
  trusted: boolean;
  sudosId?: number;
}

export class Users {
  private readonly filePath: string;
  private users: Map<string, StoredUser> = new Map();
  loaded = false;

  constructor(filePath = '/home/.local/share/aquarius/users.json') {
    this.filePath = filePath;
    void this.load();
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const list: StoredUser[] = JSON.parse(data) as StoredUser[];
      this.users = new Map(list.map((u) => [u.uuid, u]));
      logger.info(`Loaded ${this.users.size} users.`);
    } catch {
      this.users = new Map();
      await this.save();
    } finally {
      this.loaded = true;
      const adminUuid = process.env.ADMIN_UUID;
      if (adminUuid && this.users.has(adminUuid)) {
        this.users.get(adminUuid)!.trusted = true;
      }
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify([...this.users.values()], null, 2), 'utf-8');
  }

  isTrusted(uuid: string): boolean {
    if (uuid === process.env.ADMIN_UUID) return true;
    return this.users.get(uuid)?.trusted ?? false;
  }

  getUser(uuid: string): StoredUser | undefined {
    return this.users.get(uuid);
  }

  listTrusted(): string {
    return [...this.users.values()]
      .filter((u) => u.trusted)
      .map((u) => `${u.uuid} (${u.name} / ${u.number})${u.sudosId ? ` → ${u.sudosId}` : ''}`)
      .join('\n');
  }

  async registerUser(ctx: SignalMessage) {
    const { sourceUuid, sourceName, sourceNumber } = ctx.rawMessage.envelope;
    this.users.set(sourceUuid, {
      uuid: sourceUuid,
      name: sourceName,
      number: sourceNumber ?? '',
      trusted: sourceUuid === env.ADMIN_UUID,
    });
    await this.save();
    await emoji(ctx, '✅');
    await reply(ctx, `Registered ${sourceName} (${sourceNumber})`);
  }

  async trust(uuid: string) {
    const user = this.users.get(uuid);
    if (user) {
      user.trusted = true;
      await this.save();
    }
  }

  async untrust(uuid: string) {
    const user = this.users.get(uuid);
    if (user) {
      user.trusted = false;
      await this.save();
    }
  }

  async link(uuid: string, sudosId: number) {
    const user = this.users.get(uuid);
    if (user) {
      user.sudosId = sudosId;
      await this.save();
    }
  }

  async unlink(uuid: string) {
    const user = this.users.get(uuid);
    if (user) {
      delete user.sudosId;
      await this.save();
    }
  }
}
