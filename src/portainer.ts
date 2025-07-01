import PortainerClient from 'portainer-api-client';
import { Stack } from './portainer.types';

export class Portainer {
  private client: PortainerClient;

  constructor(url: string, apiKey: string) {
    this.client = new PortainerClient({ url, key: apiKey });
  }

  async listStacks(): Promise<Stack[]> {
    const stacks = await this.client.callAPIWithKey('GET', '/api/stacks');
    return Array.isArray(stacks) ? stacks : [];
  }

  async getStack(identifier: string | number): Promise<Stack | null> {
    return /^\d+$/.test(String(identifier))
        ? this.getStackById(Number(identifier))
        : this.getStackByName(String(identifier));
  }

  private async getStackById(id: number): Promise<Stack | null> {
    return this.client.callAPIWithKey('GET', `/api/stacks/${id}`).catch(() => null);
  }

  private async getStackByName(name: string): Promise<Stack | null> {
    const stacks = await this.listStacks();
    return stacks.find(stack => stack.Name.toLowerCase() === name.toLowerCase()) || null;
  }

  async startStack(stack: Stack): Promise<void> {
    await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/start?endpointId=${stack.EndpointId}`);
  }

  async stopStack(stack: Stack): Promise<void> {
    await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/stop?endpointId=${stack.EndpointId}`);
  }

  async redeployStack(stack: Stack): Promise<void> {
    const fileResponse = await this.client.callAPIWithKey('GET', `/api/stacks/${stack.Id}/file`);
    if (!fileResponse?.StackFileContent) throw new Error('No content');

    const updatePayload = {
      id: stack.Id,
      StackFileContent: fileResponse.StackFileContent,
      Env: [],
      Prune: false,
      Webhook: null,
      PullImage: true,
    };

    await this.client.callAPIWithKey('PUT', `/api/stacks/${stack.Id}?endpointId=${stack.EndpointId}`, updatePayload);
  }

  async getImageStatus(stack: Stack): Promise<'updated' | 'outdated'> {
    const res = await this.client.callAPIWithKey(
        'GET',
        `/api/stacks/${stack.Id}/images_status?refresh=true`,
    );
    return res.Status;
  }

  async getStackDetails(stack: Stack): Promise<Stack> {
    return stack;
  }
}
