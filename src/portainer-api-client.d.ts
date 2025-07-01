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

    callAPIWithKey(
      requestMethod: string,
      apiPath: string,
      requestData?: any,
      requestHeaders?: Record<string, string>,
    ): Promise<any>;

    callAPI(
      requestMethod: string,
      apiPath: string,
      requestData?: any,
      requestHeaders?: Record<string, string>,
    ): Promise<any>;

    private _getAPIAuthHeaders(): Promise<{ Authorization: string } | { 'X-API-Key': string }>;

    private _refreshAuthToken(): Promise<void>;

    static validURL(url: string): boolean;
  }

  export default PortainerClient;
}
