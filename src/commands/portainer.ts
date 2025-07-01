import { Commands, CommandHandler } from '../commands';
import { reply, emoji } from '../signal';
import { Portainer } from '../portainer';

export function registerPortainerCommands(commands: Commands, portainer: Portainer) {
    const wrap = (fn: CommandHandler): CommandHandler => fn;

    commands.register('stacks', wrap(async (ctx) => {
        const stacks = await portainer.listStacks();
        if (stacks.length === 0) return reply(ctx, 'No stacks found.');
        const msg = stacks.map(s => `• ${s.Name} (stack: ${s.Id})`).join('\n');
        await reply(ctx, `Stacks:\n${msg}`);
    }), {
        name: 'stacks',
        args: [],
        description: 'List stacks',
    });

    commands.register('stack', wrap(async (ctx, args) => {
        const stack = await portainer.getStack(args[0]);
        if (!stack) return reply(ctx, 'Stack not found.');
        await reply(ctx, JSON.stringify(stack, null, 2));
    }), {
        name: 'stack',
        args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
        description: 'Get stack details',
    });

    commands.register('start', wrap(async (ctx, args) => {
        const stack = await portainer.getStack(args[0]);
        if (!stack) return reply(ctx, 'Stack not found.');
        await portainer.startStack(stack);
        await emoji(ctx, '👍');
    }), {
        name: 'start',
        args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
        description: 'Start stack',
    });

    commands.register('stop', wrap(async (ctx, args) => {
        const stack = await portainer.getStack(args[0]);
        if (!stack) return reply(ctx, 'Stack not found.');
        await portainer.stopStack(stack);
        await emoji(ctx, '👍');
    }), {
        name: 'stop',
        args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
        description: 'Stop stack',
    });

    commands.register('status', wrap(async (ctx, args) => {
        const stack = await portainer.getStack(args[0]);
        if (!stack) return reply(ctx, 'Stack not found.');
        const status = stack.Status === 1 ? '[✅ Up]' : '[❌ Down]';
        const imgStatus = await portainer.getImageStatus(stack);
        const imgMsg = imgStatus === 'updated' ? 'Images are up to date.' : 'Images are outdated.';
        await reply(ctx, `Stack: ${stack.Name} (stack: ${stack.Id}) ${status}\n${imgMsg}`);
    }), {
        name: 'status',
        args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
        description: 'Get stack status',
    });

    commands.register('redeploy', wrap(async (ctx, args) => {
        const stack = await portainer.getStack(args[0]);
        if (!stack) return reply(ctx, 'Stack not found.');
        await portainer.redeployStack(stack);
        await emoji(ctx, '🔄');
    }), {
        name: 'redeploy',
        args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
        description: 'Redeploy stack',
    });
}
