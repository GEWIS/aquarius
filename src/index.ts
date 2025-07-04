// @ts-expect-error WebSocket is not defined in the global scope
import WebSocket from 'ws';
import { sendSavedReaction, SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import { Commands } from './commands';
import { Portainer } from './portainer';
import { registerCommands } from './commands/signal';
import { registerPortainerCommands } from './commands/portainer';
import { env } from './env';
import { Users } from './users';
import { registerUserCommands } from './commands/users';
import { argumentsRegistry } from './commands/arguments';
import { registerSudoSOSPlugin } from './plugins/sudosos';
import { logger } from './core/logger';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
global.WebSocket = WebSocket;

export const UPDATE_REQUEST_MESSAGE = '/app/data/update-request-message.json';

function main() {
  const users = new Users();
  const commands = new Commands(users, argumentsRegistry);
  const api = {
    commands,
    argumentsRegistry,
    users,
  };

  registerUserCommands(commands, users);

  const source = new SignalRpcMessageSource(env.SIGNAL_CLI_API);

  const { PORTAINER_URL, PORTAINER_API_KEY } = env;

  if (PORTAINER_URL === '' || PORTAINER_API_KEY === '') {
    logger.warn('Portainer URL or API key not set. Skipping Portainer integration.');
  } else {
    const portainer = new Portainer(PORTAINER_URL, PORTAINER_API_KEY);
    registerPortainerCommands(commands, portainer);
  }

  registerCommands(commands, source);

  registerSudoSOSPlugin(api);

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  // If reaction was prepared, send it
  void sendSavedReaction(UPDATE_REQUEST_MESSAGE);

  logger.info('Bot started.');
}

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  main();
}
