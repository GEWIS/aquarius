import { AxiosError } from 'axios';
import { logger } from '../core/logger';
import { SignalMessage } from '../core/message';
import { emoji, reply } from '../modules/signal/signal';
import { StoredUser, Users } from '../modules/users/users';
import { registerGeneral } from './general';
import { ArgParseError, ArgTuple, ArgumentsRegistry, CommandArg } from './arguments';

// ======== Types ========

export type CommandContext = {
  msg: SignalMessage;
  command: Command;
  args: string[];
  callerId: string;
  user?: StoredUser;
};

export type CommandPolicy = (ctx: CommandContext) => Promise<boolean>;
export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export interface Command {
  handler: CommandHandler;
  description: CommandDescription;
  policy?: CommandPolicy;
  registered?: boolean; // Defaults to true
}

export type CommandDescription = {
  name: string;
  args: { name: string; required: boolean; description: string; type?: string }[];
  description: string;
  aliases?: string[];
};

export type TypedContext<TArgs extends readonly CommandArg[]> = CommandContext & {
  parsedArgs: ArgTuple<TArgs>;
};

export type TypedCommandHandler<TArgs extends readonly CommandArg[]> = (ctx: TypedContext<TArgs>) => Promise<void>;

// ======== Command Registry Class ========

export class Commands {
  private readonly users: Users;
  private readonly argumentsRegistry: ArgumentsRegistry;
  private readonly commands = new Map<string, Command>();
  private readonly aliases = new Map<string, string>();

  constructor(users: Users, registry: ArgumentsRegistry) {
    this.users = users;
    this.argumentsRegistry = registry;
    registerGeneral(this);
  }

  // --- Registration Helpers ---

  register(command: Command) {
    logger.trace('Registering command:', command.description.name);
    this.commands.set(command.description.name.toLowerCase(), command);
    this.registerAliases(command, command.description.aliases || []);
  }

  registerAliases(command: Command, aliases: string[]) {
    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), command.description.name.toLowerCase());
    }
  }

  /**
   * Typed command registration helper.
   * Automatically parses arguments and handles user-facing argument errors.
   */
  registerTyped<TArgs extends CommandArg[]>({
    description,
    handler,
    policy,
    registered,
  }: {
    description: { name: string; args: TArgs; description: string; aliases?: string[] };
    handler: TypedCommandHandler<TArgs>;
    policy?: CommandPolicy;
    registered?: boolean;
  }) {
    this.register({
      description,
      policy,
      registered,
      handler: async (ctx: CommandContext) => {
        try {
          const parsedArgs = await this.argumentsRegistry.parseArguments(description.args, ctx.args, {
            users: this.users,
            message: ctx.msg,
          });
          await handler({ ...ctx, parsedArgs });
        } catch (err) {
          await emoji(ctx.msg, '❌');
          await reply(
            ctx.msg,
            `❌ ${err instanceof ArgParseError ? err.message : String(err)}\n` +
              `Usage: ${description.name} ${formatUsage(description.args)}`,
          );
        }
      },
    });
  }

  // --- Command Execution ---

  /**
   * Parses the incoming message to extract the command and its arguments.
   */
  private extractArgs(msg: SignalMessage): {
    commandString: string;
    args: string[];
    callerId: string;
    user?: StoredUser;
  } {
    const content = msg.message.trim();
    const [cmd, ...args] = content.slice(1).trim().split(/\s+/);
    const user = this.users.getUser(msg.rawMessage.envelope.sourceUuid);
    return {
      commandString: cmd,
      args,
      callerId: msg.rawMessage.envelope.sourceUuid,
      user,
    };
  }

  /**
   * Returns the Command object for a given string (with alias support).
   */
  getCommand(commandString: string): Command | undefined {
    const lower = commandString.toLowerCase();
    return this.commands.get(lower) ?? this.commands.get(this.aliases.get(lower) ?? '');
  }

  /**
   * Returns all registered commands.
   */
  getCommands(): Command[] {
    return [...this.commands.values()];
  }

  /**
   * Evaluates the policy (middleware) for a command.
   */
  async testPolicy(ctx: CommandContext): Promise<boolean> {
    if (!this.users.loaded) {
      logger.warn('Users not loaded, policy will always fail');
      return false;
    }
    if (!ctx.command.policy) return true;
    return ctx.command.policy(ctx);
  }

  /**
   * Executes a command from an incoming SignalMessage.
   */
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

      const ctx: CommandContext = { msg, command, args, callerId, user };
      if (command.registered === false) {
        await command.handler(ctx);
        return;
      }
      if (user?.trusted !== true) {
        logger.trace('User', callerId, 'is not trusted.');
        await emoji(msg, '🚫');
        return;
      }
      if (!(await this.testPolicy(ctx))) {
        logger.trace('User', callerId, 'is not authorized by policy.');
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

// ======== Utility ========

/**
 * Returns a usage string like: <foo> [bar]
 */
function formatUsage(args: { name: string; required: boolean }[]) {
  return args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ');
}
