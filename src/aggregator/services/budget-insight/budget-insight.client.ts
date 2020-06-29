import { HttpService, Injectable, LoggerService } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { AxiosResponse } from 'axios';
import {
  Connection,
  ConnectionWrapper,
  JWTokenResponse,
  Transaction,
  TransactionWrapper,
  BIConfigurations,
  BudgetInsightCredentials,
} from '../../interfaces/budget-insight.interface';

/**
 * Body returned after registration
 */
interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Budget Insight Client Config
 */
export interface ClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

/**
 * BudgetInsightClient
 */
@Injectable()
export class BudgetInsightClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    public biCredentialsMap: BudgetInsightCredentials = new Map(),
  ) {}

  /**
   * Register the tmpToken
   *
   * @param tmpToken A budget insight temporary token
   * @returns The permanent token
   */
  public async register(serviceAccountId: string, tmpToken: string): Promise<string> {
    const config: ClientConfig = this.getClientConfig(serviceAccountId);
    const url: string = `${config.baseUrl}auth/token/access`;

    this.logger.debug(`Create user with tmpToken ${tmpToken} on ${url}`);
    const resp: AxiosResponse<AuthTokenResponse> = await this.httpService
      .post(
        url,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
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
   * Get a user JWT
   * @returns The user JWT token
   */
  public async getUserJWT(serviceAccountId: string): Promise<JWTokenResponse> {
    const config: ClientConfig = this.getClientConfig(serviceAccountId);
    const url: string = `${config.baseUrl}auth/jwt`;
    this.logger.debug(`Get a user JWT on ${url}`);

    const resp: AxiosResponse<JWTokenResponse> = await this.httpService
      .post(url, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
      })
      .toPromise();

    return resp.data;
  }

  /**
   * Synchronous synchronisation
   * The PUT will block until the synchronisation is finished
   *
   * @param permanentToken The Budget Insight token
   */
  public async synchronize(serviceAccountId: string, permanentToken: string): Promise<void> {
    const baseUrl: string = this.getClientConfig(serviceAccountId).baseUrl;
    const url: string = `${baseUrl}/users/me/connections?expand=accounts`;
    await this.httpService.put<ConnectionWrapper>(url, {}, this.setHeaders(permanentToken)).toPromise();

    return;
  }

  /**
   * Fetch the user connections
   *
   * @param permanentToken The Budget Insight token
   * @param expand Return connections with the accounts and the corresponding bank
   */
  public async fetchConnection(
    serviceAccountId: string,
    permanentToken: string,
    expand: boolean = true,
  ): Promise<Connection[]> {
    const baseUrl: string = this.getClientConfig(serviceAccountId).baseUrl;
    const url: string = `${baseUrl}/users/me/connections${expand ? '?expand=accounts,bank' : ''}`;
    const resp: AxiosResponse<ConnectionWrapper> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data.connections.filter((co: Connection) => co.active);
  }

  /**
   * Get the client config for budget insight.
   */
  public getClientConfig(serviceAccountId: string): ClientConfig {
    const biCredentials: BIConfigurations | undefined = this.biCredentialsMap.get(serviceAccountId);

    if (biCredentials === undefined) {
      throw new Error('UNKNOWN_BI_CREDS');
    }

    return {
      clientId: biCredentials.clientId,
      clientSecret: biCredentials.clientSecret,
      baseUrl: biCredentials.baseUrl,
    };
  }

  /**
   * Fetch the user transactions
   *
   * @param permanentToken The Budget Insight token
   */
  public async fetchTransactions(serviceAccountId: string, permanentToken: string): Promise<Transaction[]> {
    const baseUrl: string = this.getClientConfig(serviceAccountId).baseUrl;
    const endDate: Date = new Date();
    const nbOfMonths: number = 3;
    const startDate: Date = moment(endDate).subtract(nbOfMonths, 'month').toDate();

    const url: string = `${baseUrl}/users/me/transactions?expand=category&min_date=${startDate.toISOString()}&max_date=${endDate.toISOString()}`;
    const resp: AxiosResponse<TransactionWrapper> = await this.httpService
      .get(url, this.setHeaders(permanentToken))
      .toPromise();

    return resp.data.transactions;
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

  /**
   * Attach an Algoan service account to Budget Insight credentials
   * @param serviceAccountClientId Service account client id
   */
  private mapBudgetInsightCredentials(serviceAccountId: string, serviceAccountClientId: string): void {
    const budgetInsightCredentials: BIConfigurations[] | undefined = this.configService.getSecret(
      'budgetInsightCredentials',
    );
    if (budgetInsightCredentials !== undefined) {
      budgetInsightCredentials.forEach((value: BIConfigurations) => {
        if (serviceAccountClientId === value.name) {
          this.biCredentialsMap.set(serviceAccountId, value);
        }
      });
    }
  }
}
