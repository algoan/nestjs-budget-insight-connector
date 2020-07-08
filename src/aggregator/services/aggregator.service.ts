import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import {
  Connection,
  JWTokenResponse,
  BudgetInsightTransaction,
  BudgetInsightAccount,
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
  public async registerClient(tmpToken: string): Promise<string> {
    return this.budgetInsightClient.register(tmpToken);
  }

  /**
   * Get user JSON Web Token
   */
  public async getJWToken(): Promise<JWTokenResponse> {
    return this.budgetInsightClient.getUserJWT();
  }

  /**
   * Create the BI Webview url base on the client and it's callbackUrl
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public generateRedirectUrl(banksUser: IBanksUser): string {
    const config: ClientConfig = this.budgetInsightClient.getClientConfig();

    return `${config.baseUrl}auth/webview/fr/connect?client_id=${config.clientId}&redirect_uri=${banksUser.callbackUrl}&response_type=code&state=&types=banks`;
  }

  /**
   * Get accounts from Budget Insight
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getAccounts(token: string): Promise<BudgetInsightAccount[]> {
    return this.budgetInsightClient.fetchBankAccounts(token);
  }

  /**
   * Will wait for the synchronisation to be finished and return transactions
   *
   * @param token The permanent token shared with BudgetInsight
   */
  public async getTransactions(token: string, accountId: number): Promise<BudgetInsightTransaction[]> {
    return this.budgetInsightClient.fetchTransactions(token, accountId);
  }

  /**
   * Get user's connections
   */
  public async getConnections(token: string): Promise<Connection[]> {
    return this.budgetInsightClient.fetchConnection(token);
  }
}
