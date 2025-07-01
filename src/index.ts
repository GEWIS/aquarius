import { SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';

console.warn('Hello World!');

async function handleMessage(ctx: SignalMessage) {
  if (!ctx.client) return;

  if (ctx.group) {
    await ctx.client
      .message()
      .sendMessage({
        number: ctx.account,
        message: 'pong',
        recipients: [ctx.group],
      })
      .catch((e) => console.error(e));
  } else {
    // fallback to private reply
    await ctx.reply('pong');
  }
}

if (require.main === module) {
  const source = new SignalRpcMessageSource(process.env.SIGNAL_CLI_API!);

  source.onMessage(async (ctx: SignalMessage) => {
    await handleMessage(ctx);
  });
  void source.start();

  console.info('Bot started.');
}
