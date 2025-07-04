import PortainerClient from 'portainer-api-client';
import { Stack } from './portainer.types';

export class Portainer {
  private client: PortainerClient;

  constructor(url: string, apiKey: string) {
    this.client = new PortainerClient({ url, key: apiKey });
  }

  // Return an array of Stack, empty if none found
  async listStacks(): Promise<Stack[]> {
    const stacks = await this.client.callAPIWithKey('GET', '/api/stacks');
    if (Array.isArray(stacks)) {
      return stacks as Stack[];
    }
    return [];
  }

  async getStack(identifier: string | number): Promise<Stack | null> {
    if (/^\d+$/.test(String(identifier))) {
      return this.getStackById(Number(identifier));
    }
    return this.getStackByName(String(identifier));
  }

  private async getStackById(id: number): Promise<Stack | null> {
    try {
      const stack = await this.client.callAPIWithKey('GET', `/api/stacks/${id}`);
      return stack as Stack;
    } catch {
      return null;
    }
  }

  private async getStackByName(name: string): Promise<Stack | null> {
    const stacks = await this.listStacks();
    const found = stacks.find((stack) => stack.Name.toLowerCase() === name.toLowerCase());
    return found ?? null;
  }

  async startStack(stack: Stack): Promise<void> {
    await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/start?endpointId=${stack.EndpointId}`);
  }

  async stopStack(stack: Stack): Promise<void> {
    await this.client.callAPIWithKey('POST', `/api/stacks/${stack.Id}/stop?endpointId=${stack.EndpointId}`);
  }

  async repullService(service: string, endpointId: number): Promise<void> {
    const request = {
      PullImage: true,
      ServiceID: service,
    };

    await this.client.callAPIWithKey('PUT', `/api/endpoints/${endpointId}/forceupdateservice`, request);
  }

  async redeployStack(stack: Stack): Promise<void> {
    const fileResponse: { StackFileContent: string } = await this.client.callAPIWithKey(
      'GET',
      `/api/stacks/${stack.Id}/file`,
    );

    if (!fileResponse?.StackFileContent) {
      throw new Error('Stack file content missing');
    }

    const updatePayload = {
      id: stack.Id,
      StackFileContent: fileResponse.StackFileContent,
      Env: [] as string[],
      Prune: false,
      Webhook: null,
      PullImage: true,
    };

    await this.client.callAPIWithKey('PUT', `/api/stacks/${stack.Id}?endpointId=${stack.EndpointId}`, updatePayload);
  }

  async getImageStatus(stack: Stack): Promise<'updated' | 'outdated' | 'unknown'> {
    try {
      const res: { Status: 'updated' | 'outdated' } = await this.client.callAPIWithKey(
        'GET',
        `/api/stacks/${stack.Id}/images_status?refresh=true`,
      );

      return res.Status ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
