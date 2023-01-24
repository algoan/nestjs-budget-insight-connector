import { get } from 'lodash';
import {
  BudgetInsightAccount,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
} from '../../interfaces/budget-insight.interface';
import { AggregatorService } from '../aggregator.service';
import { ClientConfig } from '../budget-insight/budget-insight.client';
import {
  EnrichedConnection,
  EnrichedBudgetInsightTransaction,
} from '../../interfaces/enriched-budget-insight.interface';

/**
 * mapBudgetInsightAccount transforms a budgetInsight array of connections into
 * an array of Banks User accounts
 * @param connections arrays from Budget Insight
 * @param transactions The complete list of transactions
 */
export const mapBudgetInsightAccount = (
  accounts: BudgetInsightAccount[],
  aggregator: AggregatorService,
  connections?: Connection[],
  connectionsInfo?: { [key: string]: BudgetInsightOwner },
  clientConfig?: ClientConfig,
): EnrichedConnection[] =>
  accounts.map((acc: BudgetInsightAccount): EnrichedConnection => {
    const connection: Connection | undefined = connections?.find((con) => con.id === acc.id_connection);
    const information: BudgetInsightOwner | undefined = get(connectionsInfo, `${connection?.id}`);
    const logoUrl: string | undefined = aggregator.getBankLogoUrl(connection, clientConfig);

    return {
      ...connection,
      connector: { ...connection?.connector, logoUrl },
      accounts: [acc],
      information,
    };
  });

/**
 * mapBudgetInsightTransactions transforms a budgetInsight transaction wrapper into
 * an array of banks user transactions
 * @param transactions TransactionWrapper from Budget Insight
 */
export const mapBudgetInsightTransactions = async (
  transactions: BudgetInsightTransaction[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<EnrichedBudgetInsightTransaction[]> =>
  Promise.all(
    transactions.map(
      async (transaction: BudgetInsightTransaction): Promise<EnrichedBudgetInsightTransaction> => ({
        ...transaction,
        category: await getCategory(aggregator, accessToken, transaction.id_category, clientConfig),
      }),
    ),
  );

/**
 * Undefined category id
 */
const undefinedCategory: number = 9998;

/**
 * Get the category of the transaction from BI
 */
const getCategory = async (
  aggregator: AggregatorService,
  accessToken: string,
  categoryId: number | null,
  clientConfig?: ClientConfig,
): Promise<{ name?: string }> => {
  if (categoryId === undefinedCategory) {
    return {};
  }
  try {
    const name: string = (await aggregator.getCategory(accessToken, categoryId, clientConfig)).name;

    return { name };
  } catch (e) {
    return {};
  }
};
