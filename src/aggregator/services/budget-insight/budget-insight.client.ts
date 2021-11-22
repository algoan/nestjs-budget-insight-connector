import { HttpService, Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';
import { config } from 'node-config-ts';
import { isNil } from 'lodash';
import {
  AnonymousUser,
  User,
  Connection,
  ConnectionWrapper,
  JWTokenResponse,
  AuthTokenResponse,
  BudgetInsightTransaction,
  BudgetInsightAccount,
  TransactionWrapper,
  AccountWrapper,
  BudgetInsightCategory,
  BudgetInsightOwner,
} from '../../interfaces/budget-insight.interface';
const DEFAULT_NUMBER_OF_MONTHS: number = 5;
/**
 * Budget Insight Client Config
 */
export interface ClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  nbOfMonths?: number;
}

/**
 * BudgetInsightClient
 */
@Injectable()
export class BudgetInsightClient {
  /**
   * Budget insight logger
   */
  private readonly logger: Logger = new Logger(BudgetInsightClient.name);

  constructor(private readonly httpService: HttpService) {
    this.httpService.axiosRef.interceptors.request.use((_config: AxiosRequestConfig): AxiosRequestConfig => {
      this.logger.log(_config, 'Request to Budget Insights');

      return _config;
    });
    this.httpService.axiosRef.interceptors.response.use(undefined, async (error: AxiosError) => {
      this.logger.error({ message: error.message, data: error.response?.data }, error.stack, error.message);

      return Promise.reject(error);
    });
  }

  /**
   * Register the tmpToken
   *
   * @param tmpToken A budget insight temporary token
   * @returns The permanent token
   */
  public async register(tmpToken: string, clientConfig?: ClientConfig): Promise<string> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}auth/token/access`;

    this.logger.debug(`Create user with tmpToken ${tmpToken} on ${url}`);
    const resp: AxiosResponse<AuthTokenResponse> = await this.httpService
      .post(
        url,
        {
          client_id: biConfig.clientId,
          client_secret: biConfig.clientSecret,
          code: tmpToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      )
      .toPromise();

    return resp.data.access_token;
  }

  /**
   * Create an anonymous user
   */
  public async createUser(clientConfig?: ClientConfig): Promise<AnonymousUser> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}auth/init`;
    this.logger.debug(`Create an anonymous user on ${url}`);

    const resp: AxiosResponse<AnonymousUser> = await this.httpService
      .post(url, {
        client_id: biConfig.clientId,
        client_secret: biConfig.clientSecret,
      })
      .toPromise();

    return resp.data;
  }

  /**
   * Get a user JWT
   * @returns The user JWT token
   */
  public async getUserJWT(clientConfig?: ClientConfig, userId?: string): Promise<JWTokenResponse> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}auth/jwt`;
    this.logger.debug(`Get a user JWT on ${url}`);

    const resp: AxiosResponse<JWTokenResponse> = await this.httpService
      .post(
        url,
        {
          client_id: biConfig.clientId,
          client_secret: biConfig.clientSecret,
          // eslint-disable-next-line no-null/no-null
          id_user: userId ?? null,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      )
      .toPromise();

    return resp.data;
  }

  /**
   * Get a user
   * @param permanentToken The user JWT token
   */
  public async getUser(permanentToken: string, clientConfig?: ClientConfig): Promise<User> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me`;
    this.logger.debug(`Get a user on ${url}`);
    const resp: AxiosResponse<User> = await this.httpService.get(url, this.setHeaders(permanentToken)).toPromise();

    return resp.data;
  }

  /**
   * Fetch the user connections
   *
   * @param permanentToken The Budget Insight token
   * @param expand Return connections with the accounts and the corresponding bank
   */
  public async fetchConnection(permanentToken: string, clientConfig?: ClientConfig): Promise<Connection[]> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me/connections?expand=connector`;
    const resp: AxiosResponse<ConnectionWrapper> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data.connections.filter((co: Connection) => co.active);
  }

  /**
   * Get personal information about the connection
   * @param token Permanent token
   * @param id Connection id
   * @param clientConfig Optional client configuration
   */
  public async getConnectionInfo(token: string, id: string, clientConfig?: ClientConfig): Promise<BudgetInsightOwner> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me/connections/${id}/informations`;
    const resp: AxiosResponse<BudgetInsightOwner> = await this.httpService.get(url, this.setHeaders(token)).toPromise();

    return resp.data;
  }

  /**
   * Get the client config for budget insight.
   */
  public getClientConfig = (clientConfig?: ClientConfig): ClientConfig =>
    clientConfig?.baseUrl !== undefined && !isNil(clientConfig?.clientSecret) && !isNil(clientConfig?.clientId)
      ? clientConfig
      : {
          clientId: config.budgetInsight.clientId,
          clientSecret: config.budgetInsight.clientSecret,
          baseUrl: config.budgetInsight.url,
        };

  /**
   * Retrieves all user's accounts from Budget Insight
   https://docs.budget-insight.com/reference/bank-accounts#list-bank-accounts
   * @param permanentToken Permanent user token
   */
  public async fetchBankAccounts(permanentToken: string, clientConfig?: ClientConfig): Promise<BudgetInsightAccount[]> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me/accounts`;
    const resp: AxiosResponse<AccountWrapper> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data.accounts;
  }

  /**
   * Fetch the user transactions
   * https://docs.budget-insight.com/reference/bank-transactions#list-transactions
   * @param permanentToken The Budget Insight token
   */
  public async fetchTransactions(
    permanentToken: string,
    accountId: number,
    clientConfig?: ClientConfig,
  ): Promise<BudgetInsightTransaction[]> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const endDate: Date = new Date(Date.now());
    const nbOfMonths: number = clientConfig?.nbOfMonths ?? DEFAULT_NUMBER_OF_MONTHS;
    const startDate: Date = moment(endDate).subtract(nbOfMonths, 'month').toDate();

    const url: string = `${baseUrl}/users/me/accounts/${accountId}/transactions?min_date=${startDate.toISOString()}&max_date=${endDate.toISOString()}`;
    const resp: AxiosResponse<TransactionWrapper> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data.transactions;
  }

  /**
   * Fetch the transaction category
   * https://docs.budget-insight.com/reference/categories
   * @param permanentToken The Budget Insight token
   */
  public async fetchCategory(
    permanentToken: string,
    categoryId: number | null,
    clientConfig?: ClientConfig,
  ): Promise<BudgetInsightCategory> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;

    const url: string = `${baseUrl}/banks/categories/${categoryId}`;
    const resp: AxiosResponse<BudgetInsightCategory> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data;
  }

  /**
   * Returns Budget Insight request headers
   * @param token access token to add in the Authorization field
   */
  private readonly setHeaders = (
    token: string,
  ): {
    headers: { 'Content-Type': string; Accept: string; Authorization: string };
  } => {
    const applicationJSONHeader: string = 'application/json';

    return {
      headers: {
        'Content-Type': applicationJSONHeader,
        Accept: applicationJSONHeader,
        Authorization: `Bearer ${token}`,
      },
    };
  };
}
