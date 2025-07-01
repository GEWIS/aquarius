import {SignalMessage} from "./message";
import {reply} from "./signal";

type CommandHandler = (ctx: SignalMessage, args: string[]) => Promise<void>;

type CommandDescription = {
    name: string;
    args: { name: string, required: boolean, description: string }[];
    description: string;
};

const ping: CommandHandler = async (ctx, args) => {
    await reply(ctx, `Pong! [${args.join(' ')}]`);
};

const help = (commands: Map<string, { description: CommandDescription }>): CommandHandler => {
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
                message += description.args
                    .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
                    .join(' ') + '\n\n';
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


export class Commands {
    constructor() {
        this.register('ping', ping, {
            description: 'Send a ping to the bot',
            args: [],
            name: 'ping',
        });
        this.register('help', help(this.commands), {
            name: 'help',
            args: [{ name: 'command', required: false, description: 'Command to get detailed help for' }],
            description: 'Show help for commands',
        });
    }

    private commands = new Map<string, { handler: CommandHandler, description: CommandDescription }>();

    register(command: string, handler: CommandHandler, description: CommandDescription) {
        this.commands.set(command.toLowerCase(), { handler, description });
    }

    async execute(ctx: SignalMessage) {
        try {
            if (!ctx.message) return;
            const content = ctx.message.trim()

            const [cmd, ...args] = content.slice(1).trim().split(/\s+/);
            const c = cmd.trim().toLowerCase();

            const command = this.commands.get(c);
            if (command) {
                await command.handler(ctx, args);
            }
        } catch (e) {
            console.error('Error executing command:', e);
        }
    }
}
