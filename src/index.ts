// @ts-expect-error WebSocket is not defined in the global scope
import WebSocket from 'ws';
import log4js from 'log4js';
import { sendSavedReaction, SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import { Commands } from './commands';
import { Portainer } from './portainer';
import { registerCommands } from './commands/signal';
import { registerPortainerCommands } from './commands/portainer';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
global.WebSocket = WebSocket;

export const logger = log4js.getLogger('🤖');
logger.level = process.env['LOG_LEVEL'] || 'info';

export const UPDATE_REQUEST_MESSAGE = '/app/data/update-request-message.json';

const commands = new Commands();

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  const source = new SignalRpcMessageSource(process.env.SIGNAL_CLI_API!);

  const portainerURL = process.env.PORTAINER_URL;
  const portainerAPIKey = process.env.PORTAINER_API_KEY;

  if (portainerURL === undefined || portainerAPIKey === undefined) {
    logger.warn('Portainer URL or API key not set. Skipping Portainer integration.');
  } else {
    const portainer = new Portainer(portainerURL, portainerAPIKey);
    registerPortainerCommands(commands, portainer);
  }

  registerCommands(commands, source);

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  // If reaction was prepared, send it
  void sendSavedReaction(UPDATE_REQUEST_MESSAGE);

  logger.info('Bot started.');
}
