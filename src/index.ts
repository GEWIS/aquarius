import assert from 'node:assert';
// @ts-expect-error WebSocket is not defined in the global scope
import WebSocket from 'ws';
import {Commands, isReaction} from './commands';
import { argumentsRegistry } from './commands/arguments';
import { registerSudoSOSModule } from './modules/sudosos';
import { logger } from './core/logger';
import { registerPortainerModule } from './modules/portainer';
import { registerSignalModule } from './modules/signal';
import { SignalMessage } from './core/message';
import { registerUserModule } from './modules/users';
import { registerUserCommands } from './modules/users/commands';
import {deleteEmoji} from "./modules/signal/signal";
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
global.WebSocket = WebSocket;

function main() {
  const users = registerUserModule();
  const commands = new Commands(users, argumentsRegistry);
  registerUserCommands(commands, users);
  const api = {
    commands,
    argumentsRegistry,
    users,
  };

  const source = registerSignalModule(api);
  assert(source, 'Signal plugin not registered');

  registerUserCommands(commands, users);
  registerSudoSOSModule(api);
  registerPortainerModule(api);

  source.onMessage(async (ctx: SignalMessage) => {
    logger.trace('Received message:', JSON.stringify(ctx.rawMessage.envelope, null, 2));
    if (isReaction(ctx)) {
      const reaction = ctx.rawMessage.envelope.dataMessage.reaction;
      logger.trace('Is reaction to bot', ctx.rawMessage.envelope.dataMessage.reaction?.emoji);
      if (reaction?.emoji === '👋') {
        await deleteEmoji(ctx, {
          reaction: '👋',
          recipient: ctx.rawMessage.envelope.sourceUuid,
          target_author: ctx.rawMessage.envelope.sourceUuid,
          timestamp: ctx.rawMessage.envelope.timestamp,
        });
      }
      return;
    }


    const mention = ctx.rawMessage.envelope.dataMessage.mentions?.find((m) => m.number === ctx.account) !== undefined;
    if (mention) {
      await commands.execute(ctx);
    }
  });
  void source.start();

  logger.info('Bot started.');
}

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  main();
}
