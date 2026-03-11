import assert from 'node:assert';
// @ts-expect-error WebSocket is not defined in the global scope
import WebSocket from 'ws';
import { Commands } from './commands';
import { argumentsRegistry } from './commands/arguments';
import { registerSudoSOSModule } from './modules/sudosos';
import { logger } from './core/logger';
import { registerPortainerModule } from './modules/portainer';
import { registerSignalModule } from './modules/signal';
import { SignalMessage } from './core/message';
import { registerUserModule } from './modules/users';
import { registerUserCommands } from './modules/users/commands';
import { registerWonderfulModule } from './modules/wonderful';
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
  const { leren } = registerSudoSOSModule(api);
  registerPortainerModule(api);
  registerWonderfulModule(api);

  source.onMessage(async (ctx: SignalMessage) => {
    void leren(ctx);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { client: _client, reply: _reply, ...loggableCtx } = ctx;
    logger.trace(`[msg] ctx=${JSON.stringify(loggableCtx)}`);
    const mentions = ctx.rawMessage.envelope.dataMessage.mentions ?? [];
    const mention = mentions.find((m) => m.number === ctx.account || m.uuid === ctx.account) !== undefined;
    logger.trace(
      `[msg] account=${ctx.account} message=${JSON.stringify(ctx.message)} mentions=${JSON.stringify(mentions)} mention=${mention}`,
    );
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
