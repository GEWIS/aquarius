import PortainerClient from 'portainer-api-client';
import { SignalMessage } from './message';
import { reply } from './signal';
import {Commands} from "./commands";
import {Stack} from "./portainer.types";

export class Portainer {
    private client: PortainerClient;

    constructor(url: string, apiKey: string) {
        this.client = new PortainerClient({ url, key: apiKey });
    }

    async listStacks(ctx: SignalMessage): Promise<void> {
        try {
            const stacks = await this.client.callAPIWithKey('GET', '/api/stacks');
            if (!Array.isArray(stacks) || stacks.length === 0) {
                await reply(ctx, 'No stacks found.');
                return;
            }
            const s: Stack[] = stacks.sort((a: any, b: any) => a.Name.localeCompare(b.Name));
            const msg = s
                .map((stack: Stack) => `• ${stack.Name} (stack: ${stack.Id})`)
                .join('\n');
            await reply(ctx, `Stacks:\n${msg}`);
        } catch (e) {
            console.error('Error listing stacks:', e);
            await reply(ctx, `Failed to list stacks: ${e}`);
        }
    }

    async stopStack(ctx: SignalMessage, args: string[]): Promise<void> {
        try {
            const stack = await this.getStack(args[0]);
            if (!stack) {
                await reply(ctx, 'Stack not found.');
                return;
            }
            await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/stop?endpointId=${stack.EndpointId}`);
            await reply(ctx, 'Stack stopped.');
        } catch (e) {
            console.error('Error stopping stack:', e);
            await reply(ctx, `Failed to stop stack: ${e}`);
        }
    }

    async startStack(ctx: SignalMessage, args: string[]): Promise<void> {
        try {
            const stack = await this.getStack(args[0]);
            if (!stack) {
                await reply(ctx, 'Stack not found.');
                return;
            }

            await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/start?endpointId=${stack.EndpointId}`);
            await reply(ctx, 'Stack started.');
        } catch (e) {
            console.error('Error starting stack:', e);
            await reply(ctx, `Failed to start stack: ${e}`);
        }
    }

    async getStackCommand(ctx: SignalMessage, args: string[]): Promise<void> {
        try {
            const stack = await this.getStack(args[0]);
            if (!stack) {
                await reply(ctx, 'Stack not found.');
                return;
            }

            const msg = `Stack: ${stack.Name} (stack: ${stack.Id})\n` +
                `Status: ${stack.Status}\n` +
                `Creation date: ${new Date(stack.CreationDate).toLocaleString()}\n` +
                `Update date: ${new Date(stack.UpdateDate).toLocaleString()}\n` +
                `Endpoint: ${stack.EndpointId}\n` +
                `Entry point: ${stack.EntryPoint}\n` +
                `Project path: ${stack.ProjectPath}\n` +
                `Additional files: ${stack.AdditionalFiles}\n` +
                `Auto update: ${stack.AutoUpdate}\n` +
                `Option: ${stack.Option}\n` +
                `Git config: ${stack.GitConfig}\n` +
                `From app template: ${stack.FromAppTemplate}\n` +
                `Namespace: ${stack.Namespace}\n` +
                `Created by: ${stack.CreatedBy}\n` +
                `Created by user ID: ${stack.CreatedByUserId}\n` +
                `Webhook: ${stack.Webhook}\n` +
                `Support relative path: ${stack.SupportRelativePath}\n` +
                `Filesystem path: ${stack.FilesystemPath}\n` +
                `Stack file version: ${stack.StackFileVersion}\n` +
                `Previous deployment info: ${stack.PreviousDeploymentInfo.Version}\n` +
                `Is detached from Git: ${stack.IsDetachedFromGit}\n`;
            await reply(ctx, msg);
        } catch (e) {
            console.error('Error getting stack:', e);
            await reply(ctx, `Failed to get stack: ${e}`);
        }
    }

    async getStack(identifier: string | number): Promise<Stack | null> {
        try {
            const isId = /^\d+$/.test(String(identifier));
            if (isId) {
                const stack = await this.getStackById(Number(identifier));
                if (!stack) return null;
                return stack;
            } else {
                const stack = await this.getStackByName(String(identifier));
                if (!stack) return null;
                return stack;
            }
        } catch (e) {
            console.error('Error getting stack:', e);
            return null;
        }
    }

    async getStackById(id: number): Promise<Stack | null> {
        try {
            const stack = await this.client.callAPIWithKey('GET', `/api/stacks/${id}`);
            if (!stack) return null;
            return stack as Stack;
        } catch (e) {
            console.error('Error getting stack by ID:', e);
            return null;
        }
    }

    async getStackByName(name: string): Promise<Stack | null> {
        try {
            const stacks = await this.client.callAPIWithKey('GET', '/api/stacks');
            if (!Array.isArray(stacks) || stacks.length === 0) return null;
            const s: Stack[] = stacks.sort((a: any, b: any) => a.Name.localeCompare(b.Name));
            const stack = s.find((stack: Stack) => stack.Name.toLowerCase() === name.toLowerCase());
            if (!stack) return null;
            return stack;
        } catch (e) {
            console.error('Error getting stack by name:', e);
            return null;
        }
    }

    registerCommands(commands: Commands) {
        commands.register('stacks', this.listStacks.bind(this), {
            name: 'stacks',
            args: [],
            description: 'List stacks',
        });
        commands.register('stack', this.getStackCommand.bind(this), {
            name: 'stack <stack>',
            args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
            description: 'Get stack details',
        });
        commands.register('start', this.startStack.bind(this), {
            name: 'start <stack>',
            args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
            description: 'Start stack',
        });
        commands.register('stop', this.stopStack.bind(this), {
            name: 'stop <stack>',
            args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
            description: 'Stop stack',
        });
    }
}
