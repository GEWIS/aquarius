import { PollingMessageSource } from './signal';
import { SignalMessage } from './message';

console.warn('Hello World');

export function handleMessage(msg: SignalMessage) {
  console.info(`Received message: "${msg.text}" from ${msg.sender}`);
  // const [cmd, ...args] = msg.text.trim().split(/\s+/);
}

if (require.main === module) {
  const source = new PollingMessageSource(
    process.env.SIGNAL_CLI_API!,
    process.env.SIGNAL_NUMBER!,
    parseInt(process.env.POLL_INTERVAL || '5', 10),
  );

  source.onMessage((msg) => {
    void handleMessage(msg);
  });
  source.start();

  console.info('Bot started.');
}
