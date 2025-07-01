import PortainerClient from 'portainer-api-client';
import { reply, SignalRpcMessageSource } from './signal';
import { SignalMessage } from './message';
import { Commands } from './commands';
import {Portainer} from "./portainer";

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
    portainer.registerCommands(commands);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const reloadGroups = async (ctx: SignalMessage, args: string[]) => {
    await source.loadGroups(ctx.account);
    await reply(ctx, 'Groups reloaded.');
  };

  commands.register('reload', reloadGroups, {
    name: 'reload',
    args: [],
    description: 'Reload groups from Signal API',
  });

  source.onMessage(async (ctx: SignalMessage) => {
    await commands.execute(ctx);
  });
  void source.start();

  console.info('Bot started.');
}
