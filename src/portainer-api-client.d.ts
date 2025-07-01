// portainer.d.ts

declare module 'portainer-api-client' {
  interface PortainerClientOptions {
    url: string;
    key?: string;
    username?: string;
    password?: string;
  }

  class PortainerClient {
    constructor(options?: PortainerClientOptions);

    callAPIWithKey<T>(
      requestMethod: string,
      apiPath: string,
      requestData?: Record<string, unknown>,
      requestHeaders?: Record<string, string>,
    ): Promise<T>;

    callAPI<T>(
      requestMethod: string,
      apiPath: string,
      requestData?: Record<string, unknown>,
      requestHeaders?: Record<string, string>,
    ): Promise<T>;

    private _getAPIAuthHeaders(): Promise<{ Authorization: string } | { 'X-API-Key': string }>;

    private _refreshAuthToken(): Promise<void>;

    static validURL(url: string): boolean;
  }

  export default PortainerClient;
}
