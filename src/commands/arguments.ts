// arguments.ts

import {SignalMessage} from "../message";
import {Users} from "../users";

export type CoreArgTypes = {
  string: string;
  number: number;
  uuid: string;
};

export type ArgTypeName = keyof CoreArgTypes | (string & {});

export interface ArgParserContext {
  message?: SignalMessage;
  users?: Users;
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
}

export const argumentsRegistry = new ArgumentsRegistry();

argumentsRegistry.register('string', async (raw) => Promise.resolve(raw));
argumentsRegistry.register('number', async (raw) => {
  const n = Number(raw);
  if (isNaN(n)) throw new Error('Not a valid number');
  return Promise.resolve(n);
});
argumentsRegistry.register('uuid', async (raw) => {
  return Promise.resolve(raw);
});

/**
 * An argument descriptor for a command.
 */
export type CommandArgDesc<TType extends string = ArgTypeName> = {
  name: string;
  type: TType;
  required: boolean;
  description: string;
};

export type ArgTuple<T extends readonly CommandArgDesc[]> = {
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
