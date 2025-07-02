import { AxiosError } from 'axios';
import { SignalMessage } from '../message';
import { emoji, reply } from '../signal';
import { TrustedNumbers } from '../trusted';
import { logger } from '../index';
import { help, logLevel, ping, version } from './general';

export type CommandHandler = (ctx: SignalMessage, args: string[]) => Promise<void>;

export type CommandDescription = {
  name: string;
  args: { name: string; required: boolean; description: string }[];
  description: string;
};

export class Commands {
  constructor() {
    this.trusted = new TrustedNumbers();
    void this.trusted.load();
    this.trusted.registerCommands(this);

    this.register('ping', ping, {
      description: 'Send a ping to the bot',
      args: [],
      name: 'ping',
    });

    this.register('log-level', logLevel, {
      description: 'Set the log level',
      args: [{ name: 'level', required: true, description: 'Log level (trace, debug, info, warn, error)' }],
      name: 'log-level',
    });

    this.register('version', version, {
      description: 'Show version',
      args: [],
      name: 'version',
    });

    this.register(
      'uptime',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (ctx, args) => {
        await reply(ctx, `[🕓] Uptime: ${Math.round(process.uptime())} seconds`);
      },
      {
        description: 'Show uptime',
        args: [],
        name: 'uptime',
      },
    );

    this.register('help', help(this.commands), {
      name: 'help',
      args: [{ name: 'command', required: false, description: 'Command to get detailed help for' }],
      description: 'Show help for commands',
    });
  }

  private commands = new Map<string, { handler: CommandHandler; description: CommandDescription }>();

  private trusted: TrustedNumbers;

  register(command: string, handler: CommandHandler, description: CommandDescription) {
    this.commands.set(command.toLowerCase(), { handler, description });
  }

  async execute(ctx: SignalMessage) {
    try {
      if (!ctx.message) return;

      if (!this.trusted.isTrusted(ctx.rawMessage.envelope.sourceUuid) || !this.trusted.loaded) {
        await emoji(ctx, '🚫');
        return;
      }

      const content = ctx.message.trim();

      const [cmd, ...args] = content.slice(1).trim().split(/\s+/);
      const c = cmd.trim().toLowerCase();

      const command = this.commands.get(c);
      if (command) {
        await command.handler(ctx, args);
      }
    } catch (e) {
      if (e instanceof AxiosError && e.response?.data) {
        logger.error('Error executing command:', e.response.data);
      } else {
        logger.error('Error executing command:', e);
      }
      await emoji(ctx, '❌');
      await reply(ctx, `Failed to execute command: ${String(e)}`);
    }
  }
}
