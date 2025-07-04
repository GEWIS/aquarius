// @ts-expect-error WebSocket is not defined in the global scope
import assert from 'node:assert';
import WebSocket from 'ws';
import { Commands } from './commands';
import { Users } from './users';
import { registerUserCommands } from './commands/users';
import { argumentsRegistry } from './commands/arguments';
import { registerSudoSOSPlugin } from './modules/sudosos';
import { logger } from './core/logger';
import { registerPortainerPlugin } from './modules/portainer';
import { registerSignalPlugin } from './modules/signal';
import { SignalMessage } from './core/message';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
global.WebSocket = WebSocket;

function main() {
  const users = new Users();
  const commands = new Commands(users, argumentsRegistry);
  const api = {
    commands,
    argumentsRegistry,
    users,
  };

  const source = registerSignalPlugin(api);
  assert(source, 'Signal plugin not registered');

  registerUserCommands(commands, users);
  registerSudoSOSPlugin(api);
  registerPortainerPlugin(api);

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  logger.info('Bot started.');
}

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  main();
}
