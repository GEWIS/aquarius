import {reply} from "../signal";
import {SignalMessage} from "../message";
import {CommandDescription, CommandHandler} from "./index";

export function ping(ctx: SignalMessage, args: string[]): Promise<void> {
    return reply(ctx, `Pong! [${args.join(' ')}]`);
}

export function help(commands: Map<string, { description: CommandDescription }>): CommandHandler {
    return async (ctx, args) => {
        if (args.length === 0) {
            // List all commands
            let message = 'Available commands:\n';
            for (const { description } of commands.values()) {
                message += `\n• **${description.name}** — ${description.description || 'No description'}`;
            }
            await reply(ctx, message);
        } else {
            // Show help for one command
            const cmdName = args[0].toLowerCase();
            const command = commands.get(cmdName);
            if (!command) {
                await reply(ctx, `Command "${cmdName}" not found.`);
                return;
            }

            const { description } = command;
            let message = `**${description.name}**\n`;
            message += description.description ? description.description + '\n' : '';
            if (description.args.length > 0) {
                message += 'Usage: ' + description.name + ' ';
                message += description.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ') + '\n\n';
                message += 'Arguments:\n';
                for (const arg of description.args) {
                    message += `• **${arg.name}**${arg.required ? ' (required)' : ''} — ${arg.description}\n`;
                }
            } else {
                message += 'No arguments.';
            }
            await reply(ctx, message, true);
        }
    };
};
