import { jwtDecode, JwtPayload } from 'jwt-decode';
import {
  AuthenticateApi,
  BalanceApi,
  BalanceResponse,
  BannersApi,
  Configuration,
  ContainersApi,
  DebtorsApi,
  FilesApi,
  InvoicesApi,
  PaginatedPointOfSaleResponse,
  PayoutRequestsApi,
  PointofsaleApi,
  PointOfSaleWithContainersResponse,
  ProductCategoriesApi,
  ProductsApi,
  RbacApi,
  ReportResponse,
  RevisionRequest,
  RootApi,
  SellerPayoutsApi,
  ServerSettingsApi,
  ServerStatusResponse,
  StripeApi,
  SubTransactionRequest,
  TransactionRequest,
  TransactionResponse,
  TransactionsApi,
  TransfersApi,
  UserResponse,
  UsersApi,
  VatGroupsApi,
  VouchergroupsApi,
  WriteoffsApi,
} from '@sudosos/sudosos-client';
import axios, { AxiosHeaders, AxiosInstance, AxiosResponse } from 'axios';
import { env } from '../../env';

let token: string = '';
let tokenExpiry: number = 0;

function parseAndSetToken(raw: string) {
  const payload = jwtDecode<JwtPayload>(raw);
  if (!payload.exp) throw new Error('Missing token expiry');
  token = raw;
  tokenExpiry = payload.exp * 1000;
}

function isTokenExpired(): boolean {
  return Date.now() >= tokenExpiry;
}

async function refreshTokenIfNeeded(): Promise<void> {
  if (!token || isTokenExpired()) {
    await getTokenEnv(); // this should call `parseAndSetToken`
  }
}

export async function getToken(basePath: string, key: string, userId: number): Promise<void> {
  const configuration = new Configuration({ basePath });
  const res = await new AuthenticateApi(configuration).keyAuthentication({ key, userId });
  parseAndSetToken(res.data.token);
}

export function getTokenEnv(): Promise<void> {
  return getToken(env.SUDOSOS_API_URL, env.SUDOSOS_API_KEY, parseInt(env.SUDOSOS_USER_ID));
}

export function updateTokenIfNecessary(response: AxiosResponse) {
  if ((response.headers as AxiosHeaders).has('Set-Authorization')) {
    const newToken = (response.headers as AxiosHeaders).get('Set-Authorization') as string;
    if (newToken) parseAndSetToken(newToken);
  }
}

const axiosInstance: AxiosInstance = axios.create();
axiosInstance.interceptors.request.use(async (config) => {
  await refreshTokenIfNeeded();
  return config;
});

axiosInstance.interceptors.response.use((response: AxiosResponse) => {
  updateTokenIfNecessary(response);
  return response;
});

export class SudoSOS {
  private apiService: ApiService;

  constructor(basePath: string) {
    void getTokenEnv().then(() => {
      if (token === '') {
        throw new Error('Unable to get token');
      }
    });
    this.apiService = new ApiService(basePath);
  }

  async getStatus(): Promise<ServerStatusResponse> {
    return (await this.apiService.rootApi.ping()).data;
  }

  async setMaintenanceMode(enabled: boolean) {
    return (await this.apiService.serverSettings.setMaintenanceMode({ enabled })).data;
  }

  async getPos(take?: number, skip?: number): Promise<PaginatedPointOfSaleResponse> {
    return (await this.apiService.pos.getAllPointsOfSale(take, skip)).data;
  }

  async getPosById(id: number): Promise<PointOfSaleWithContainersResponse> {
    return (await this.apiService.pos.getSinglePointOfSale(id)).data;
  }

  async getUserById(id: number): Promise<UserResponse> {
    return (await this.apiService.user.getIndividualUser(id)).data;
  }

  async makeTransaction(
    pointOfSale: RevisionRequest,
    c: { container: RevisionRequest; to: number },
    product: RevisionRequest,
    amount: number,
    from: number,
    price: number,
  ): Promise<TransactionResponse> {
    const totalPriceInclVat = {
      amount: price * amount,
      precision: 2,
      currency: 'EUR',
    };

    const subTransactions: SubTransactionRequest = {
      container: c.container,
      subTransactionRows: [
        {
          product,
          amount,
          totalPriceInclVat,
        },
      ],
      to: c.to,
      totalPriceInclVat,
    };

    const t: TransactionRequest = {
      createdBy: parseInt(env.SUDOSOS_USER_ID),
      from,
      pointOfSale,
      subTransactions: [subTransactions],
      totalPriceInclVat,
    };

    return (await this.apiService.transaction.createTransaction(t)).data;
  }

  async getBalance(userId: number): Promise<BalanceResponse> {
    return (await this.apiService.balance.getBalanceId(userId)).data;
  }

  async getReport(userId: number, start = new Date('2020-01-01'), end = new Date()): Promise<ReportResponse> {
    return (await this.apiService.user.getUsersPurchasesReport(userId, start.toISOString(), end.toISOString())).data;
  }
}

class ApiService {
  private readonly _authenticateApi: AuthenticateApi;

  private readonly _balanceApi: BalanceApi;

  private readonly _debtorsApi: DebtorsApi;

  private readonly _usersApi: UsersApi;

  private readonly _posApi: PointofsaleApi;

  private readonly _categoryApi: ProductCategoriesApi;

  private readonly _transactionApi: TransactionsApi;

  private readonly _bannerApi: BannersApi;

  private readonly _rootApi: RootApi;

  private readonly _voucherGroupApi: VouchergroupsApi;

  private readonly _containerApi: ContainersApi;

  private readonly _filesApi: FilesApi;

  private readonly _invoicesApi: InvoicesApi;

  private readonly _payoutsApi: PayoutRequestsApi;

  private readonly _productsApi: ProductsApi;

  private readonly _transfersApi: TransfersApi;

  private readonly _vatGroupsApi: VatGroupsApi;

  private readonly _stripeApi: StripeApi;

  private readonly _rbacApi: RbacApi;

  private readonly _openBannerApi: BannersApi;

  private readonly _sellerPayoutsApi: SellerPayoutsApi;

  private readonly _writeOffsApi: WriteoffsApi;

  private readonly _serverSettingsApi: ServerSettingsApi;

  constructor(basePath: string) {
    const withKeyConfiguration = new Configuration({
      accessToken: () => token,
    });

    this._authenticateApi = new AuthenticateApi(withKeyConfiguration, basePath, axiosInstance);
    this._balanceApi = new BalanceApi(withKeyConfiguration, basePath, axiosInstance);
    this._debtorsApi = new DebtorsApi(withKeyConfiguration, basePath, axiosInstance);
    this._usersApi = new UsersApi(withKeyConfiguration, basePath, axiosInstance);
    this._posApi = new PointofsaleApi(withKeyConfiguration, basePath, axiosInstance);
    this._categoryApi = new ProductCategoriesApi(withKeyConfiguration, basePath, axiosInstance);
    this._transactionApi = new TransactionsApi(withKeyConfiguration, basePath, axiosInstance);
    this._bannerApi = new BannersApi(withKeyConfiguration, basePath, axiosInstance);
    this._openBannerApi = new BannersApi(undefined, basePath, axiosInstance);
    this._rootApi = new RootApi(undefined, basePath, axiosInstance);
    this._voucherGroupApi = new VouchergroupsApi(withKeyConfiguration, basePath, axiosInstance);
    this._containerApi = new ContainersApi(withKeyConfiguration, basePath, axiosInstance);
    this._filesApi = new FilesApi(withKeyConfiguration, basePath, axiosInstance);
    this._invoicesApi = new InvoicesApi(withKeyConfiguration, basePath, axiosInstance);
    this._payoutsApi = new PayoutRequestsApi(withKeyConfiguration, basePath, axiosInstance);
    this._productsApi = new ProductsApi(withKeyConfiguration, basePath, axiosInstance);
    this._transfersApi = new TransfersApi(withKeyConfiguration, basePath, axiosInstance);
    this._vatGroupsApi = new VatGroupsApi(withKeyConfiguration, basePath, axiosInstance);
    this._stripeApi = new StripeApi(withKeyConfiguration, basePath, axiosInstance);
    this._rbacApi = new RbacApi(withKeyConfiguration, basePath, axiosInstance);
    this._sellerPayoutsApi = new SellerPayoutsApi(withKeyConfiguration, basePath, axiosInstance);
    this._writeOffsApi = new WriteoffsApi(withKeyConfiguration, basePath, axiosInstance);
    this._serverSettingsApi = new ServerSettingsApi(withKeyConfiguration, basePath, axiosInstance);
  }

  get authenticate(): AuthenticateApi {
    return this._authenticateApi;
  }

  get balance(): BalanceApi {
    return this._balanceApi;
  }

  get debtor(): DebtorsApi {
    return this._debtorsApi;
  }

  get pos(): PointofsaleApi {
    return this._posApi;
  }

  get category(): ProductCategoriesApi {
    return this._categoryApi;
  }

  get transaction(): TransactionsApi {
    return this._transactionApi;
  }

  get banner(): BannersApi {
    return this._bannerApi;
  }

  get rootApi(): RootApi {
    return this._rootApi;
  }

  get borrelkaart(): VouchergroupsApi {
    return this._voucherGroupApi;
  }

  get container(): ContainersApi {
    return this._containerApi;
  }

  get files(): FilesApi {
    return this._filesApi;
  }

  get invoices(): InvoicesApi {
    return this._invoicesApi;
  }

  get payouts(): PayoutRequestsApi {
    return this._payoutsApi;
  }

  get products(): ProductsApi {
    return this._productsApi;
  }

  get transfers(): TransfersApi {
    return this._transfersApi;
  }

  get vatGroups(): VatGroupsApi {
    return this._vatGroupsApi;
  }

  get stripe(): StripeApi {
    return this._stripeApi;
  }

  get rbac(): RbacApi {
    return this._rbacApi;
  }

  get user(): UsersApi {
    return this._usersApi;
  }

  get openBanner(): BannersApi {
    return this._openBannerApi;
  }

  get sellerPayouts(): SellerPayoutsApi {
    return this._sellerPayoutsApi;
  }

  get writeOffs(): WriteoffsApi {
    return this._writeOffsApi;
  }

  get serverSettings(): ServerSettingsApi {
    return this._serverSettingsApi;
  }
}
