import { ModuleApi } from '../../core/module-api';
import { env } from '../../env';
import { logger } from '../../core/logger';
import { sendSavedReaction, SignalRpcMessageSource } from './signal';
import { registerCommands } from './commands';

export const UPDATE_REQUEST_MESSAGE = '/app/data/update-request-message.json';

export function registerSignalModule(api: ModuleApi) {
  const url = env.SIGNAL_CLI_API;
  if (!url) {
    logger.fatal('Signal URL not set. Skipping Signal integration.');
    return;
  }

  const source = new SignalRpcMessageSource(env.SIGNAL_CLI_API);
  registerCommands(api.commands, source);

  // plugin loaded, send reaction
  void sendSavedReaction(UPDATE_REQUEST_MESSAGE);
  return source;
}
