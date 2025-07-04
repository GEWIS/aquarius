import fs from 'fs/promises';
import path from 'path';
import { env } from './env';

import { logger } from './core/logger';
import { emoji, reply } from './plugins/signal/signal';
import { SignalMessage } from './core/message';

export interface StoredUser {
  uuid: string;
  name: string;
  number: string;
  trusted: boolean;
  sudosId?: number;
  teams?: Set<number>;
}

export enum TEAMS {
  GUEST = 1,
  ABC = 2,
  CBC = 3,
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

      for (const user of list) {
        // Fix: force teams into Set<number> always
        const raw: unknown = user.teams;
        if (Array.isArray(raw)) {
          user.teams = new Set(raw);
        } else if (raw && typeof raw === 'object') {
          // JSON-serialized Set shows as `{}` — treat as empty
          user.teams = new Set();
        } else {
          user.teams = undefined;
        }
      }

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

  getUsers() {
    return this.users.values();
  }

  async save() {
    logger.debug('Saving users', this.users.values());
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    const serializableUsers = [...this.users.values()].map((u) => ({
      ...u,
      teams: u.teams ? [...u.teams.values()] : undefined,
    }));

    await fs.writeFile(this.filePath, JSON.stringify(serializableUsers, null, 2), 'utf-8');
  }

  isTrusted(uuid: string): boolean {
    if (uuid === process.env.ADMIN_UUID) return true;
    return this.users.get(uuid)?.trusted ?? false;
  }

  getUser(uuid: string): StoredUser | undefined {
    return this.users.get(uuid);
  }

  trusted(): StoredUser[] {
    return [...this.users.values()].filter((u) => u.trusted);
  }

  teams(uuid: string): Set<number> | undefined {
    const user = this.users.get(uuid);
    if (!user) {
      return undefined;
    }

    if (!user.teams) {
      user.teams = new Set();
      return undefined;
    }

    return user.teams;
  }

  removeTeam(uuid: string, team: number) {
    const user = this.users.get(uuid);
    if (user) {
      if (!user.teams) {
        user.teams = new Set();
      }
      user.teams.delete(team);
      void this.save();
    }
  }

  addTeam(uuid: string, team: number) {
    const user = this.users.get(uuid);
    if (user) {
      if (!user.teams) {
        user.teams = new Set();
      }
      user.teams.add(team);
      void this.save();
    }
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
