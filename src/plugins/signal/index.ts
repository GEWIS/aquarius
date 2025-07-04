import { PluginApi } from '../../core/plugin-api';
import { env } from '../../env';
import { sendSavedReaction, SignalRpcMessageSource } from './signal';
import { logger } from '../../core/logger';
import { registerCommands } from './commands';

export const UPDATE_REQUEST_MESSAGE = '/app/data/update-request-message.json';

export function registerSignalPlugin(api: PluginApi) {
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
