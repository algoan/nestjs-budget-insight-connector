import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import { Connection, JWTokenResponse, Transaction } from '../interfaces/budget-insight.interface';
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
  public async registerClient(serviceAccountId: string, tmpToken: string): Promise<string> {
    return this.budgetInsightClient.register(serviceAccountId, tmpToken);
  }

  /**
   * Get user JSON Web Token
   */
  public async getJWToken(serviceAccountId: string): Promise<JWTokenResponse> {
    return this.budgetInsightClient.getUserJWT(serviceAccountId);
  }

  /**
   * Create the BI Webview url base on the client and it's callbackUrl
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public generateRedirectUrl(serviceAccountId: string, banksUser: IBanksUser): string {
    const config: ClientConfig = this.budgetInsightClient.getClientConfig(serviceAccountId);

    return `${config.baseUrl}auth/webview/fr/connect?client_id=${config.clientId}&redirect_uri=${banksUser.callbackUrl}&response_type=code&state=&types=banks`;
  }

  /**
   * Will wait for the synchronisation to be finished and return accounts
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getAccounts(serviceAccountId: string, token: string): Promise<Connection[]> {
    await this.budgetInsightClient.synchronize(serviceAccountId, token);

    return this.budgetInsightClient.fetchConnection(serviceAccountId, token);
  }

  /**
   * Will wait for the synchronisation to be finished and return transactions
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getTransactions(serviceAccountId: string, token: string): Promise<Transaction[]> {
    return this.budgetInsightClient.fetchTransactions(serviceAccountId, token);
  }

  /**
   * Get user's connections
   */
  public async getConnections(serviceAccountId: string, token: string): Promise<Connection[]> {
    return this.budgetInsightClient.fetchConnection(serviceAccountId, token, false);
  }
}
