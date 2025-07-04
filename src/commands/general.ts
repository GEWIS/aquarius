import path from 'path';
import { readFile } from 'node:fs/promises';
import { emoji, reply } from '../signal';
import { logger } from '../index';
import { env } from '../env';
import { isAdmin, isGuest } from './policy';
import { Command, CommandContext, CommandHandler, Commands } from './index';

export function ping(ctx: CommandContext): Promise<void> {
  return reply(ctx.msg, `Pong! [${ctx.args.join(' ')}]`);
}

export function help(commands: Commands): CommandHandler {
  return async (ctx: CommandContext) => {
    const { args } = ctx;
    if (args.length === 0) {
      // List all commands
      let message = 'Available commands:\n';

      const available: Command[] = [];
      for (const c of [...commands.getCommands()]) {
        if (c.registered === false || c.policy === undefined || (await c.policy(ctx))) {
          available.push(c);
        }
      }

      for (const { description } of available) {
        message += `\n• **${description.name}** — ${description.description || 'No description'}`;
      }
      await reply(ctx.msg, message);
    } else {
      // Show help for one command
      const cmdName = args[0].toLowerCase();
      const command = commands.getCommand(cmdName);
      if (!command) {
        await reply(ctx.msg, `Command "${cmdName}" not found.`);
        return;
      }

      const { description } = command;
      let message = `**${description.name}**\n`;

      const aliases = description.aliases ? description.aliases.join(', ') : '';
      message += aliases ? `*${aliases}\n\n*` : '';

      message += description.description ? description.description + '\n' : '';
      if (description.args.length > 0) {
        message += 'Usage: ' + description.name + ' ';
        message += description.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ') + '\n\n';
        message += 'Arguments:\n';
        for (const arg of description.args) {
          message += `• **${arg.name}**${arg.required ? ' (required)' : ''} — ${arg.description}\n`;
        }
      } else {
        message += 'No arguments.';
      }
      await reply(ctx.msg, message);
    }
  };
}

export async function fetchLatestVersion(repo: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      logger.error('Error fetching latest version:', response.statusText);
      return 'unknown';
    }

    const data = (await response.json()) as { tag_name: string };
    return data.tag_name;
  } catch (error) {
    logger.error('Error fetching latest version:', error);
    return 'unknown';
  }
}

export function isLatest(version: string): boolean {
  const versionTag = `v${env.DOCKER_VERSION.split(':')[0]}`;
  return version === versionTag;
}

export async function version(ctx: CommandContext): Promise<void> {
  const { DOCKER_VERSION, GIT_COMMIT_SHA, REPOSITORY } = env;

  try {
    const latestVersion = await fetchLatestVersion(REPOSITORY);
    if (isLatest(latestVersion)) {
      await reply(ctx.msg, `[✅] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA})`);
      return;
    } else if (latestVersion === 'unknown') {
      await reply(ctx.msg, `[❔] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA}), Latest Version: unknown`);
    } else {
      const message = `[❌] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA}), Latest Version: ${latestVersion}`;
      await reply(ctx.msg, message);
    }
  } catch (error) {
    await reply(ctx.msg, 'Could not fetch the latest version.');
    console.error('Error comparing versions:', error);
  }
}

export async function logLevel(ctx: CommandContext): Promise<void> {
  const level = ctx.args[0].toLowerCase();
  switch (level) {
    case 'trace':
      logger.level = 'trace';
      break;
    case 'debug':
      logger.level = 'debug';
      break;
    case 'info':
      logger.level = 'info';
      break;
    case 'warn':
      logger.level = 'warn';
      break;
    case 'error':
      logger.level = 'error';
      break;
    default:
      await reply(ctx.msg, 'Invalid log level. Valid levels: debug, info, warn, error, trace');
      return;
  }
  await emoji(ctx.msg, '✅');
}

export async function changelog(ctx: CommandContext): Promise<void> {
  const repo = env.REPOSITORY;
  if (!repo) {
    await reply(ctx.msg, 'Repository not configured.');
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) {
      await reply(ctx.msg, `Could not fetch release info (${res.status})`);
      return;
    }

    const data: {
      name: string;
      tag_name: string;
      body: string;
    } = (await res.json()) as { name: string; tag_name: string; body: string };
    const title = data.name || data.tag_name || 'Latest Release';
    const rawBody = data.body || '(No description)';
    const body = rawBody.trim().slice(0, 1900);

    let msg = `**${title}**\n\n${body}`;
    if (body.length >= 1900) {
      msg += '\n\n...truncated';
    }

    await reply(ctx.msg, msg);
  } catch (err) {
    await reply(ctx.msg, 'Could not fetch changelog from GitHub.');
    console.error('changelog command error:', err);
  }
}

export async function logs(ctx: CommandContext): Promise<void> {
  const n = parseInt(ctx.args[0], 10);
  if (isNaN(n) || n <= 0) {
    await reply(ctx.msg, 'Usage: logs <n> — where n is a positive number of lines');
    return;
  }

  const logPath = path.resolve('app/data/app.log');

  try {
    const data = await readFile(logPath, 'utf8');
    const lines = data.trim().split('\n');
    const lastLines = lines.slice(-n).join('\n');

    await reply(ctx.msg, `Last ${Math.min(n, lines.length)} log lines:\n\n${lastLines}`);
  } catch (err) {
    await reply(ctx.msg, 'Could not read log file.');
    console.error('logs command error:', err);
  }
}

const add = (a: number, b: number) => a + b;

export function registerGeneral(commands: Commands) {
  commands.registerTyped({
    description: {
      name: 'add',
      args: [
        { name: 'a', required: true, description: 'First number', type: 'number' },
        { name: 'b', required: true, description: 'Second number', type: 'number' },
      ] as const,
      description: 'Add two numbers',
      aliases: ['a'],
    },
    handler: async (ctx) => {
      const [a, b] = ctx.parsedArgs;
      await reply(ctx.msg, `${a} + ${b} = ${add(a, b)}`);
    },
    registered: true,
    policy: isGuest,
  });

  commands.register({
    description: {
      name: 'ping',
      args: [],
      description: 'Send a ping to the bot',
      aliases: ['p'],
    },
    handler: ping,
    registered: true,
  });

  commands.register({
    description: {
      name: 'log-level',
      args: [{ name: 'level', required: true, description: 'Log level (trace, debug, info, warn, error)' }],
      description: 'Set the log level',
      aliases: ['ll'],
    },
    handler: logLevel,
    registered: true,
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'version',
      args: [],
      description: 'Show version',
      aliases: ['v'],
    },
    handler: version,
    registered: true,
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'help',
      args: [{ name: 'command', required: false, description: 'Command to get detailed help for' }],
      description: 'Show help for commands',
      aliases: ['h'],
    },
    handler: async (ctx: CommandContext) => {
      const h = help(commands);
      await h(ctx);
    },
    registered: true,
  });

  commands.register({
    description: {
      name: 'logs',
      args: [{ name: 'n', required: true, description: 'Number of lines to show' }],
      description: 'Show the last n lines of the log file',
      aliases: ['log'],
    },
    handler: logs,
    policy: isAdmin,
  });

  commands.register({
    description: {
      name: 'changelog',
      args: [],
      description: 'Show the latest changelog',
      aliases: ['ch'],
    },
    handler: changelog,
    registered: false,
  });
}
