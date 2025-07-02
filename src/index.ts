// @ts-expect-error WebSocket is not defined in the global scope
import WebSocket from 'ws';
import log4js from 'log4js';
import { sendSavedReaction, SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import { Commands } from './commands';
import { Portainer } from './portainer';
import { registerCommands } from './commands/signal';
import { registerPortainerCommands } from './commands/portainer';
import { env } from './env';
import { SudoSOS } from './sudosos';
import { registerSudoSOSCommands } from './commands/sudosos';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
global.WebSocket = WebSocket;

export const logger = log4js.getLogger('🤖');
logger.level = env.LOG_LEVEL || 'info';

export const UPDATE_REQUEST_MESSAGE = '/app/data/update-request-message.json';

const commands = new Commands();

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  const source = new SignalRpcMessageSource(env.SIGNAL_CLI_API);

  const { PORTAINER_URL, PORTAINER_API_KEY } = env;

  if (PORTAINER_URL === '' || PORTAINER_API_KEY === '') {
    logger.warn('Portainer URL or API key not set. Skipping Portainer integration.');
  } else {
    const portainer = new Portainer(PORTAINER_URL, PORTAINER_API_KEY);
    registerPortainerCommands(commands, portainer);
  }

  const { SUDOSOS_API_URL, SUDOSOS_API_KEY, SUDOSOS_USER_ID } = env;
  if (SUDOSOS_API_URL === '' || SUDOSOS_API_KEY === '' || SUDOSOS_USER_ID === '') {
    logger.warn('SudoSOS API URL, API key or user ID not set. Skipping SudoSOS integration.');
  } else {
    const sudosos = new SudoSOS(SUDOSOS_API_URL);
    logger.info('SudoSOS initialized');
    registerSudoSOSCommands(commands, sudosos);
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
