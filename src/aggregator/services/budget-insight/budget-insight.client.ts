import { URL } from 'url';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';
import { config } from 'node-config-ts';
import { isNil } from 'lodash';
import { lastValueFrom, Observable } from 'rxjs';
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
  AccessTokenResponse,
  AuthJWTokenResponse,
  AccountOwnership,
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
  language?: string;
  deleteUsers?: boolean;
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
    const url: string = `${biConfig.baseUrl}/auth/token/access`;

    this.logger.debug(`Create user with tmpToken ${tmpToken} on ${url}`);
    const resp: AxiosResponse<AuthTokenResponse> = await this.toPromise(
      this.httpService.post<AuthTokenResponse>(
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
      ),
    );

    return resp.data.access_token;
  }

  /**
   * Create an anonymous user
   */
  public async createUser(clientConfig?: ClientConfig): Promise<AnonymousUser> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}/auth/init`;
    this.logger.debug(`Create an anonymous user on ${url}`);

    const resp: AxiosResponse<AnonymousUser> = await this.toPromise(
      this.httpService.post(url, {
        client_id: biConfig.clientId,
        client_secret: biConfig.clientSecret,
      }),
    );

    return resp.data;
  }

  /**
   * Get an existing user JWT
   * @returns The user JWT token
   */
  public async getExistingUserJWT(clientConfig?: ClientConfig, userId?: string): Promise<JWTokenResponse> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}/auth/renew`;
    this.logger.debug(`Get a user JWT on ${url}`);

    try {
      const resp: AxiosResponse<AccessTokenResponse> = await this.toPromise(
        this.httpService.post(
          url,
          {
            grant_type: 'client_credentials',
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
        ),
      );

      const response: JWTokenResponse = {
        jwt_token: resp.data.access_token,
        payload: {
          domain: biConfig.baseUrl,
          id_user: userId as string,
        },
      };

      return response;
    } catch (err) {
      this.logger.error("An error occurred when generating user's JWT token");
      throw new UnauthorizedException(err);
    }
  }

  /**
   * Get a new user JWT
   * @returns the new JWT token
   */
  public async getNewUserJWT(clientConfig?: ClientConfig): Promise<JWTokenResponse> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}/auth/init`;
    this.logger.debug(`Get a user JWT on ${url}`);

    try {
      const resp: AxiosResponse<AuthJWTokenResponse> = await this.toPromise(
        this.httpService.post(
          url,
          {
            client_id: biConfig.clientId,
            client_secret: biConfig.clientSecret,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const response: JWTokenResponse = {
        jwt_token: resp.data.auth_token,
        payload: {
          domain: biConfig.baseUrl,
          id_user: resp.data.id_user,
        },
      };

      return response;
    } catch (err) {
      this.logger.error("An error occurred when generating new user's JWT token");
      throw new UnauthorizedException(err);
    }
  }

  /**
   * Get a user
   * @param permanentToken The user JWT token
   */
  public async getUser(permanentToken: string, clientConfig?: ClientConfig): Promise<User> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me`;
    this.logger.debug(`Get a user on ${url}`);
    const resp: AxiosResponse<User> = await this.toPromise(this.httpService.get(url, this.setHeaders(permanentToken)));

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
    const resp: AxiosResponse<ConnectionWrapper> = await this.toPromise(
      this.httpService.get(url, this.setHeaders(permanentToken)),
    );

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
    const resp: AxiosResponse<BudgetInsightOwner> = await this.toPromise(
      this.httpService.get(url, this.setHeaders(token)),
    );

    return resp.data;
  }

  /**
   * Get the client config for budget insight.
   * Also parse the provided URL
   * @param serviceAccountConfig Configurations optionally defined in the SA
   */
  public getClientConfig = (serviceAccountConfig?: ClientConfig): ClientConfig => {
    const clientConfig: ClientConfig =
      serviceAccountConfig?.baseUrl !== undefined &&
      !isNil(serviceAccountConfig?.clientSecret) &&
      !isNil(serviceAccountConfig?.clientId)
        ? serviceAccountConfig
        : {
            clientId: config.budgetInsight.clientId,
            clientSecret: config.budgetInsight.clientSecret,
            baseUrl: config.budgetInsight.url,
          };

    const parsedUrl: URL = new URL(clientConfig.baseUrl);

    return {
      ...clientConfig,
      baseUrl: `${parsedUrl.origin}/${config.budgetInsight.apiVersion}`,
    };
  };

  /**
   * Retrieves all user's accounts from Budget Insight
   https://docs.budget-insight.com/reference/bank-accounts#list-bank-accounts
   * @param permanentToken Permanent user token
   */
  public async fetchBankAccounts(permanentToken: string, clientConfig?: ClientConfig): Promise<BudgetInsightAccount[]> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me/accounts`;
    const resp: AxiosResponse<AccountWrapper> = await this.toPromise(
      this.httpService.get(url, this.setHeaders(permanentToken)),
    );

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
    const limit: number = config.budgetInsight.paginationLimit;
    let offset: number = 0;

    let uri: string;
    let url: string;

    let transactions: BudgetInsightTransaction[] = [];
    let resp: AxiosResponse<TransactionWrapper>;
    do {
      uri = `/users/me/accounts/${accountId}/transactions?limit=${limit}&offset=${
        offset * limit
      }&min_date=${startDate.toISOString()}&max_date=${endDate.toISOString()}`;
      url = `${baseUrl}${uri}`;
      resp = await this.toPromise(this.httpService.get(url, this.setHeaders(permanentToken)));
      transactions = [...transactions, ...resp.data.transactions];

      offset++;
    } while (resp.data.transactions.length > 0);

    return transactions;
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
    const resp: AxiosResponse<BudgetInsightCategory> = await this.toPromise(
      this.httpService.get(url, this.setHeaders(permanentToken)),
    );

    return resp.data;
  }

  /**
   * Fetch the account ownerships
   * https://docs.powens.com/api-reference/products/data-aggregation/account-ownerships#list-account-ownerships
   * @param token the user token
   * @param clientConfig the client config
   */
  public async fetchAccountOwnerships(token: string, clientConfig?: ClientConfig): Promise<AccountOwnership[]> {
    const baseUrl: string = this.getClientConfig(clientConfig).baseUrl;
    const url: string = `${baseUrl}/users/me/account_ownerships`;
    const response: AxiosResponse<AccountOwnership[]> = await this.toPromise(
      this.httpService.get(url, this.setHeaders(token)),
    );

    return response.data;
  }

  /**
   * Delete user by its id
   * https://docs.budget-insight.com/reference/users#delete-a-user
   * @param permanentToken The Budget Insight token
   */
  public async deleteUser(id: number, permanentToken: string, clientConfig?: ClientConfig): Promise<void> {
    const biConfig: ClientConfig = this.getClientConfig(clientConfig);
    const url: string = `${biConfig.baseUrl}/users/${id}`;
    this.logger.debug(`Deleting the connexion with the id ${id}`);

    await this.toPromise(this.httpService.delete(url, this.setHeaders(permanentToken)));
  }

  /**
   * Convert an Observable to a promise
   * @param response Axios observable response
   * @returns Promisify observable
   */
  private async toPromise<T>(response: Observable<T>): Promise<T> {
    return lastValueFrom(response);
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
