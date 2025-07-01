import PortainerClient from 'portainer-api-client';
import { SignalMessage } from './message';
import { emoji, reply } from './signal';
import { Commands } from './commands';
import { Stack } from './portainer.types';

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
      const msg = s.map((stack: Stack) => `• ${stack.Name} (stack: ${stack.Id})`).join('\n');
      await reply(ctx, `Stacks:\n${msg}`);
    } catch (e) {
      console.error('Error listing stacks:', e);
      await reply(ctx, `Failed to list stacks: ${e}`);
    }
  }

  async stackStatus(ctx: SignalMessage, args: string[]): Promise<void> {
    try {
      const stack = await this.getStack(args[0]);
      if (!stack) {
        await reply(ctx, 'Stack not found.');
        return;
      }
      const status = stack.Status;

      const imageStatus = (await this.client.callAPIWithKey(
        'GET',
        `/api/stacks/${stack.Id}/images_status?refresh=true`,
      )) as {
        Status: 'updated' | 'outdated';
      };
      const msg = imageStatus.Status === 'updated' ? 'Images are up to date.' : 'Images are outdated.';
      const running = status === 1 ? '[✅ Up]' : '[❌ Down]';

      await reply(ctx, `Stack: ${stack.Name} (stack: ${stack.Id}) ${running}\n${msg}`);
    } catch (e) {
      console.error('Error getting stack status:', e);
      await reply(ctx, `Failed to get stack status: ${e}`);
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
      await emoji(ctx, '👍');
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
      await emoji(ctx, '👍');
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

      const msg = JSON.stringify(stack, null, 2);
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

  async redeployStack(ctx: SignalMessage, args: string[]): Promise<void> {
    try {
      const stack = await this.getStack(args[0]);
      if (!stack) {
        await reply(ctx, 'Stack not found.');
        return;
      }

      const fileResponse = await this.client.callAPIWithKey('GET', `/api/stacks/${stack.Id}/file`).catch(async (e) => {
        console.error('Failed to fetch stack file:', e);
      });

      if (!fileResponse || !fileResponse.StackFileContent) {
        await reply(ctx, 'Failed to fetch stack file content.');
        return;
      }

      const updatePayload = {
        id: stack.Id,
        StackFileContent: fileResponse.StackFileContent,
        Env: [],
        Prune: false,
        Webhook: null,
        PullImage: true,
      };

      await this.client.callAPIWithKey('PUT', `/api/stacks/${stack.Id}?endpointId=${stack.EndpointId}`, updatePayload);
      await emoji(ctx, '🔄');
    } catch (e) {
      console.error('Error redeploying stack:', e);
      await reply(ctx, `Failed to redeploy stack: ${e}`);
    }
  }

  registerCommands(commands: Commands) {
    commands.register('stacks', this.listStacks.bind(this), {
      name: 'stacks',
      args: [],
      description: 'List stacks',
    });
    commands.register('stack', this.getStackCommand.bind(this), {
      name: 'stack',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack details',
    });
    commands.register('start', this.startStack.bind(this), {
      name: 'start',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Start stack',
    });
    commands.register('stop', this.stopStack.bind(this), {
      name: 'stop',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Stop stack',
    });
    commands.register('status', this.stackStatus.bind(this), {
      name: 'status',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Get stack status',
    });
    commands.register('redeploy', this.redeployStack.bind(this), {
      name: 'redeploy',
      args: [{ name: 'stack', required: true, description: 'Stack name or ID' }],
      description: 'Redeploy stack',
    });
  }
}
