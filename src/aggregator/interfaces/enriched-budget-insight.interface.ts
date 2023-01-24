import {
  BudgetInsightAccount,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
} from './budget-insight.interface';

/**
 * Transaction data
 *
 * BI transaction with the category name added
 */
export type EnrichedBudgetInsightTransaction = BudgetInsightTransaction & {
  category: { name?: string };
};

/**
 * Account data
 *
 * BI Account with transactions added
 */
export type EnrichedAccount = BudgetInsightAccount & { transactions?: EnrichedBudgetInsightTransaction[] };

/**
 * Connection data
 *
 * Connection with a matching connector and information data with the account list
 */
export type EnrichedConnection = Partial<Omit<Connection, 'connector'>> & {
  connector?: Partial<Connection['connector']> & { logoUrl?: string };
  accounts: EnrichedAccount[];
  information?: BudgetInsightOwner;
};
