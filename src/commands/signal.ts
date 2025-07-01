import {SignalMessage} from "../message";
import {reply, SignalRpcMessageSource} from "../signal";
import {CommandHandler, Commands} from "./index";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const reloadGroups = (source: SignalRpcMessageSource): CommandHandler => async (ctx: SignalMessage, args: string[]) => {
    await source.loadGroups(ctx.account);
    await reply(ctx, 'Groups reloaded.');
};

export function registerCommands(commands: Commands, source: SignalRpcMessageSource) {
    commands.register('reload', reloadGroups(source), {
        name: 'reload',
        args: [],
        description: 'Reload groups from Signal API',
    });
}