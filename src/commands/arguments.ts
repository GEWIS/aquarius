// arguments.ts

import { MessageMention, SignalMessage } from '../message';
import { StoredUser, Users } from '../users';
import { logger } from '../index';

export type CoreArgTypes = {
  string: string;
  number: number;
  uuid: string;
  user: StoredUser;
};

export type ArgTypeName = keyof CoreArgTypes | (string & {});

export interface ArgParserContext {
  message?: SignalMessage;
  users?: Users;
  argIndex?: number;
  args?: string[];
  [key: string]: unknown;
}

export type ArgParser<T = unknown> = (raw: string, ctx: ArgParserContext) => Promise<T> | T;

export class ArgumentsRegistry {
  private parsers = new Map<string, ArgParser>();

  /**
   * Register a parser for a type.
   */
  register<T>(type: string, parser: ArgParser<T>): void {
    this.parsers.set(type, parser);
  }

  /**
   * Get the parser for a type. Throws if not found.
   */
  get<T>(type: string): ArgParser<T> {
    const parser = this.parsers.get(type);
    if (!parser) throw new Error(`No parser registered for arg type "${type}"`);
    return parser as ArgParser<T>;
  }

  /**
   * Check if a type is registered.
   */
  has(type: string): boolean {
    return this.parsers.has(type);
  }

  async parseArguments<T extends readonly CommandArg[]>(
    descs: T,
    rawArgs: string[],
    ctx: ArgParserContext,
  ): Promise<ArgTuple<T>> {
    const out: unknown[] = [];
    for (let i = 0; i < descs.length; i++) {
      const def = descs[i];
      const raw = rawArgs[i];
      if (raw == null) {
        if (def.required) throw new ArgParseError(`Missing required argument: ${def.name}`);
        out.push(undefined);
        continue;
      }
      const parser = this.get(def.type);
      try {
        out.push(await parser(raw, { ...ctx, argIndex: i, args: rawArgs }));
      } catch (e) {
        throw new ArgParseError(`Invalid value for "${def.name}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return out as ArgTuple<T>;
  }
}

export const argumentsRegistry = new ArgumentsRegistry();

argumentsRegistry.register('string', async (raw) => Promise.resolve(raw));
argumentsRegistry.register('number', async (raw) => {
  const n = Number(raw);
  if (isNaN(n)) throw new Error('Not a valid number');
  return Promise.resolve(n);
});

export function isMention(str: string) {
  return str === '￼';
}

argumentsRegistry.register('user', (raw, ctx) => {
  if (!ctx.users || !ctx.message || !ctx.args) throw new ArgParseError('User context or message missing');
  const mentions: MessageMention[] = ctx.message.rawMessage.envelope.dataMessage.mentions ?? [];
  const index = ctx.argIndex ?? 0;

  // Build a list of which arguments are 'mention fillers'
  const mentionArgs: number[] = [];
  for (let i = 0; i < ctx.args.length; i++) {
    logger.trace('Checking arg', ctx.args[i], 'for mention', isMention(ctx.args[i]));
    if (isMention(ctx.args[i])) mentionArgs.push(i);
  }

  const realMentions = mentions.slice(1);

  const mentionIndex = mentionArgs.indexOf(index);
  if (mentionIndex !== -1 && realMentions[mentionIndex]) {
    const uuid = realMentions[mentionIndex].uuid;
    const user = ctx.users.getUser(uuid);
    if (user) return user;
  }

  // If not, fallback to direct lookup by raw (uuid/number/etc)
  const user = ctx.users.getUser(raw);
  if (user) return user;

  throw new ArgParseError(`Could not resolve user for argument "${raw}"`);
});

/**
 * An argument descriptor for a command.
 */
export type CommandArg<TType extends string = ArgTypeName> = {
  name: string;
  type: TType;
  required: boolean;
  description: string;
};

export type ArgTuple<T extends readonly CommandArg[]> = {
  [K in keyof T]: T[K] extends { type: infer S } ? (S extends keyof CoreArgTypes ? CoreArgTypes[S] : unknown) : never;
};

/**
 * Arg parsing error for uniform reporting.
 */
export class ArgParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgParseError';
  }
}
