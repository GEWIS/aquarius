import { SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import { Commands } from './commands';
import { Portainer } from './portainer';
import {registerCommands} from "./commands/signal";
import {registerPortainerCommands} from "./commands/portainer";

console.warn('Hello World!');

const commands = new Commands();

if (require.main === module) {
  const source = new SignalRpcMessageSource(process.env.SIGNAL_CLI_API!);

  const portainerURL = process.env.PORTAINER_URL;
  const portainerAPIKey = process.env.PORTAINER_API_KEY;

  if (portainerURL === undefined || portainerAPIKey === undefined) {
    console.warn('Portainer URL or API key not set. Skipping Portainer integration.');
  } else {
    const portainer = new Portainer(portainerURL, portainerAPIKey);
    registerPortainerCommands(commands, portainer);
  }

  registerCommands(commands, source);

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  console.info('Bot started.');
}
