import { Injectable } from '@nestjs/common';
import {
  AccountOwnership,
  BudgetInsightAccount,
  BudgetInsightCategory,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  JWTokenResponse,
} from '../interfaces/budget-insight.interface';
import { BudgetInsightClient, ClientConfig } from './budget-insight/budget-insight.client';

/**
 * AggregatorService
 */
@Injectable()
export class AggregatorService {
  constructor(private readonly budgetInsightClient: BudgetInsightClient) {}
  /**
   * Validate the creation of the current user
   *
   * @param tmpToken Budget Insight token returned from the web view
   */
  public async registerClient(tmpToken: string, clientConfig?: ClientConfig): Promise<string> {
    return this.budgetInsightClient.register(tmpToken, clientConfig);
  }

  /**
   * Create a user and return its id
   */
  public async createUser(clientConfig?: ClientConfig): Promise<number> {
    return (await this.budgetInsightClient.createUser(clientConfig)).id_user;
  }

  /**
   * Get a user id from its token
   */
  public async getUserId(token: string, clientConfig?: ClientConfig): Promise<number> {
    return (await this.budgetInsightClient.getUser(token, clientConfig)).id;
  }

  /**
   * Delete a user by it's id
   */
  public async deleteUser(id: number, permanentToken: string, clientConfig?: ClientConfig): Promise<void> {
    return this.budgetInsightClient.deleteUser(id, permanentToken, clientConfig);
  }

  /**
   * Get user JSON Web Token
   */
  public async getJWTokenForExistingUser(clientConfig?: ClientConfig, userId?: string): Promise<JWTokenResponse> {
    return this.budgetInsightClient.getExistingUserJWT(clientConfig, userId);
  }

  /**
   * Get new user JSON Web Token
   */
  public async getJWTokenForNewUser(clientConfig?: ClientConfig) {
    return this.budgetInsightClient.getNewUserJWT(clientConfig);
  }

  /**
   * Create the BI Webview url base on the client and it's callbackUrl
   *
   */
  public generateRedirectUrl(callbackUrl: string, clientConfig?: ClientConfig): string {
    const config: ClientConfig = this.budgetInsightClient.getClientConfig(clientConfig);

    const language = config.language ?? 'fr';

    return `${config.baseUrl}/auth/webview/${language}/connect?client_id=${config.clientId}&redirect_uri=${callbackUrl}&response_type=code&state=&types=banks`;
  }

  /**
   * Get accounts from Budget Insight
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getAccounts(token: string, clientConfig?: ClientConfig): Promise<BudgetInsightAccount[]> {
    return this.budgetInsightClient.fetchBankAccounts(token, clientConfig);
  }

  /**
   * Will wait for the synchronisation to be finished and return transactions
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getTransactions(
    token: string,
    accountId: number,
    clientConfig?: ClientConfig,
  ): Promise<BudgetInsightTransaction[]> {
    return this.budgetInsightClient.fetchTransactions(token, accountId, clientConfig);
  }

  /**
   * Get user's connections
   */
  public async getConnections(token: string, clientConfig?: ClientConfig): Promise<Connection[]> {
    return this.budgetInsightClient.fetchConnection(token, clientConfig);
  }

  /**
   * Get personal information from the associated connection
   * @param token Permanent token
   * @param id Connection id
   * @param clientConfig Optional client configuration
   */
  public async getInfo(token: string, id: string, clientConfig?: ClientConfig): Promise<BudgetInsightOwner> {
    return this.budgetInsightClient.getConnectionInfo(token, id, clientConfig);
  }

  /**
   * Gets a budget insight category
   */
  public async getCategory(
    token: string,
    categoryId: number | null,
    clientConfig?: ClientConfig,
  ): Promise<BudgetInsightCategory> {
    return this.budgetInsightClient.fetchCategory(token, categoryId, clientConfig);
  }

  /**
   * Get account ownerships
   * @param token
   * @param clientConfig
   */
  public async getAccountOwnerships(token: string, clientConfig?: ClientConfig): Promise<AccountOwnership[]> {
    return this.budgetInsightClient.fetchAccountOwnerships(token, clientConfig);
  }

  /**
   * Get the url of the logo of the bank
   */
  public getBankLogoUrl(connection?: Connection, clientConfig?: ClientConfig): string | undefined {
    return connection?.connector?.uuid === undefined
      ? undefined
      : `${this.budgetInsightClient.getClientConfig(clientConfig).baseUrl}/logos/${
          connection.connector.uuid
        }-thumbnail@2x.png`;
  }
}
