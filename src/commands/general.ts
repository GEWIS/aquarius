import { reply } from '../signal';
import { SignalMessage } from '../message';
import { logger } from '../index';
import { env } from '../env';
import { CommandDescription, CommandHandler } from './index';

export function ping(ctx: SignalMessage, args: string[]): Promise<void> {
  return reply(ctx, `Pong! [${args.join(' ')}]`);
}

export function help(commands: Map<string, { description: CommandDescription }>): CommandHandler {
  return async (ctx, args) => {
    if (args.length === 0) {
      // List all commands
      let message = 'Available commands:\n';
      for (const { description } of commands.values()) {
        message += `\n• **${description.name}** — ${description.description || 'No description'}`;
      }
      await reply(ctx, message);
    } else {
      // Show help for one command
      const cmdName = args[0].toLowerCase();
      const command = commands.get(cmdName);
      if (!command) {
        await reply(ctx, `Command "${cmdName}" not found.`);
        return;
      }

      const { description } = command;
      let message = `**${description.name}**\n`;
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
      await reply(ctx, message);
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function version(ctx: SignalMessage, args: string[]): Promise<void> {
  const { DOCKER_VERSION, GIT_COMMIT_SHA, REPOSITORY } = env;

  try {
    const latestVersion = await fetchLatestVersion(REPOSITORY);
    if (isLatest(latestVersion)) {
      await reply(ctx, `[✅] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA})`);
      return;
    } else if (latestVersion === 'unknown') {
      await reply(ctx, `[❔] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA}), Latest Version: unknown`);
    } else {
      const message = `[❌] Current Version: ${DOCKER_VERSION} (${GIT_COMMIT_SHA}), Latest Version: ${latestVersion}`;
      await reply(ctx, message);
    }
  } catch (error) {
    await reply(ctx, 'Could not fetch the latest version.');
    console.error('Error comparing versions:', error);
  }
}
