import { CommandContext, CommandHandler, Commands } from '../../commands';
import { isAdmin } from '../../commands/policy';
import { reply, SignalRpcMessageSource } from './signal';

const reloadGroups =
  (source: SignalRpcMessageSource): CommandHandler =>
  async (ctx: CommandContext) => {
    await source.loadGroups(ctx.msg.account);
    await reply(ctx.msg, 'Groups reloaded.');
  };

export function registerCommands(commands: Commands, source: SignalRpcMessageSource) {
  commands.register({
    description: {
      name: 'reload-groups',
      args: [],
      description: 'Reload groups',
    },
    handler: reloadGroups(source),
    policy: isAdmin,
  });
}
