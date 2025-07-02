import { AxiosError } from 'axios';
import { SignalMessage } from '../message';
import { emoji, reply } from '../signal';
import { logger } from '../index';
import { StoredUser, Users } from '../users';
import { registerGeneral } from './general';

export interface Command {
  handler: CommandHandler;
  description: CommandDescription;
  policy?: CommandPolicy;

  // Defaults to true
  registered?: boolean;
}

export type CommandPolicy = (ctx: CommandContext) => Promise<boolean>;

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export type CommandDescription = {
  name: string;
  args: { name: string; required: boolean; description: string }[];
  description: string;
  aliases?: string[];
};

export type CommandContext = {
  msg: SignalMessage;
  command: Command;
  args: string[];
  callerId: string;
  user?: StoredUser;
};

export class Commands {
  constructor(users: Users) {
    this.users = users;
    registerGeneral(this);
  }

  commands = new Map<string, Command>();

  private aliases = new Map<string, string>();

  private users: Users;

  getCommand(commandString: string): Command | undefined {
    const command = this.commands.get(commandString.toLowerCase());
    if (command) return command;
    const alias = this.aliases.get(commandString.toLowerCase());
    if (alias) return this.commands.get(alias);
    return undefined;
  }

  registerAliases(command: Command, aliases: string[]) {
    aliases.forEach((alias) => this.aliases.set(alias.toLowerCase(), command.description.name.toLowerCase()));
  }

  register(command: Command) {
    logger.trace('Registering command:', command.description.name);
    this.commands.set(command.description.name.toLowerCase(), command);
    if (command.description.aliases) {
      this.registerAliases(command, command.description.aliases);
    }
  }

  extractArgs(ctx: SignalMessage): {
    commandString: string;
    args: string[];
    callerId: string;
    user?: StoredUser;
  } {
    const content = ctx.message.trim();

    const [cmd, ...args] = content.slice(1).trim().split(/\s+/);

    const user = this.users.getUser(ctx.rawMessage.envelope.sourceUuid);

    return {
      commandString: cmd,
      args,
      callerId: ctx.rawMessage.envelope.sourceUuid,
      user,
    };
  }

  async testPolicy(ctx: CommandContext): Promise<boolean> {
    if (!this.users.loaded) {
      logger.warn('Users not loaded, policy will always fail');
      return false;
    }

    if (!ctx.command.policy) return true;

    return ctx.command.policy(ctx);
  }

  async execute(msg: SignalMessage) {
    try {
      if (!msg.message) return;
      const { commandString, args, callerId, user } = this.extractArgs(msg);

      const command = this.getCommand(commandString);
      if (!command) {
        logger.trace('Command not found:', commandString);
        await emoji(msg, '❓');
        return;
      }

      const ctx: CommandContext = {
        msg,
        command,
        args,
        callerId,
        user,
      };

      const passed = await this.testPolicy(ctx);

      if (command.registered === false) {
        await command.handler(ctx);
        return;
      } else if (user?.trusted !== true) {
        logger.trace('User', msg.rawMessage.envelope.sourceUuid, 'is not trusted.');
        await emoji(msg, '🚫');
        return;
      }

      if (!passed) {
        logger.trace('User', msg.rawMessage.envelope.sourceUuid, 'is not trusted.');
        await emoji(msg, '🚫');
        return;
      }

      await command.handler(ctx);
    } catch (e) {
      if (e instanceof AxiosError && e.response?.data) {
        logger.error('Error executing command:', e.response.data);
      } else {
        logger.error('Error executing command:', e);
      }
      await emoji(msg, '❌');
      await reply(msg, `Failed to execute command: ${String(e)}`);
    }
  }
}
