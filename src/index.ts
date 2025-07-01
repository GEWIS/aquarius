import { SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import {Commands} from "./commands";

console.warn('Hello World!');

const commands = new Commands();

if (require.main === module) {
  const source = new SignalRpcMessageSource(process.env.SIGNAL_CLI_API!);

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  console.info('Bot started.');
}
