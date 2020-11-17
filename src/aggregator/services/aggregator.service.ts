import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import {
  Connection,
  JWTokenResponse,
  BudgetInsightTransaction,
  BudgetInsightAccount,
  BudgetInsightCategory,
  BudgetInsightOwner,
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
   * Get user JSON Web Token
   */
  public async getJWToken(clientConfig?: ClientConfig): Promise<JWTokenResponse> {
    return this.budgetInsightClient.getUserJWT(clientConfig);
  }

  /**
   * Create the BI Webview url base on the client and it's callbackUrl
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public generateRedirectUrl(banksUser: IBanksUser, clientConfig?: ClientConfig): string {
    const config: ClientConfig = this.budgetInsightClient.getClientConfig(clientConfig);

    return `${config.baseUrl}auth/webview/fr/connect?client_id=${config.clientId}&redirect_uri=${banksUser.callbackUrl}&response_type=code&state=&types=banks`;
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
}
