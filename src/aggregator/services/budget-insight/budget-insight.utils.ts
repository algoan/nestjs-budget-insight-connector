import * as moment from 'moment-timezone';
import {
  PostBanksUserTransactionDTO,
  BanksUserTransactionType as TransactionType,
  UsageType,
  AccountType,
  PostBanksUserAccountDTO,
} from '@algoan/rest';
import { AggregatorService } from '../aggregator.service';
import {
  BudgetInsightTransaction,
  AccountType as BiAccountType,
  BankAccountUsage as BiUsageType,
  TransactionType as BiTransactionType,
  BudgetInsightAccount,
  Connection,
} from '../../interfaces/budget-insight.interface';

/**
 * mapBudgetInsightAccount transforms a budgetInsight array of connections into
 * an array of Banks User accounts
 * @param connections arrays from Budget Insight
 * @param transactions The complete list of transactions
 */
export const mapBudgetInsightAccount = (
  accounts: BudgetInsightAccount[],
  connections: Connection[],
): PostBanksUserAccountDTO[] =>
  accounts.map((acc: BudgetInsightAccount) => {
    const connection: Connection = connections.find((con) => con.id === acc.id_connection);

    return fromBIToAlgoanAccounts(acc, connection?.bank?.name);
  });

/**
 * Converts a single BI account instance to Algoan format
 * @param account
 */
const fromBIToAlgoanAccounts = (account: BudgetInsightAccount, bankName?: string): PostBanksUserAccountDTO => ({
  balanceDate: new Date(mapDate(account.last_update)).toISOString(),
  balance: account.balance,
  bank: bankName,
  connectionSource: 'BUDGET_INSIGHT',
  type: mapAccountType(account.type),
  bic: account.bic,
  iban: account.iban,
  currency: account.currency.id,
  name: account.name,
  reference: account.id.toString(),
  status: account.disabled ? 'ACTIVE' : 'CLOSED',
  usage: mapUsageType(account.usage),
  loanDetails:
    // eslint-disable-next-line no-null/no-null
    account.loan !== null && account.loan !== undefined
      ? {
          amount: account.loan.total_amount,
          debitedAccountId: account.loan.id_account,
          startDate: mapDate(account.loan.subscription_date),
          endDate: mapDate(account.loan.maturity_date),
          payment: account.loan.next_payment_amount,
          interestRate: account.loan.rate,
          remainingCapital: account.balance,
          type: 'OTHER',
        }
      : undefined,
  savingsDetails: account.type,
});

/**
 * mapBudgetInsightTransactions transforms a budgetInsight transaction wrapper into
 * an array of banks user transactions
 * @param transactions TransactionWrapper from Budget Insight
 */
export const mapBudgetInsightTransactions = async (
  transactions: BudgetInsightTransaction[],
  accountType: AccountType,
  accessToken: string,
  aggregator: AggregatorService,
): Promise<PostBanksUserTransactionDTO[]> =>
  Promise.all(
    transactions.map(
      async (transaction: BudgetInsightTransaction): Promise<PostBanksUserTransactionDTO> => ({
        amount: transaction.value,
        simplifiedDescription: transaction.simplified_wording,
        description: transaction.original_wording,
        banksUserCardId: transaction.card,
        reference: transaction.id.toString(),
        userDescription: transaction.wording,
        category: await getCategory(aggregator, accessToken, transaction.id_category),
        type: mapTransactionType(transaction.type),
        date:
          accountType === AccountType.CREDIT_CARD
            ? moment.tz(transaction.rdate, 'Europe/Paris').toISOString()
            : moment.tz(transaction.date, 'Europe/Paris').toISOString(),
      }),
    ),
  );

const getCategory = async (
  aggregator: AggregatorService,
  accessToken: string,
  transactionId: number,
): Promise<string> => {
  try {
    return (await aggregator.getCategory(accessToken, transactionId)).name;
  } catch (e) {
    return 'UNKNOWN';
  }
};

/**
 * mapDate transforms an iso date in string into a timestamp or undefined
 * @param isoDate date from budget Insight, if null returns undefined
 */
const mapDate = (isoDate: string): number =>
  isoDate ? moment.tz(isoDate, 'Europe/Paris').toDate().getTime() : moment().toDate().getTime();

/**
 * AccountTypeMapping
 */
interface AccountTypeMapping {
  [index: string]: AccountType;
}

const ACCOUNT_TYPE_MAPPING: AccountTypeMapping = {
  [BiAccountType.CHECKING]: AccountType.CHECKINGS,
  [BiAccountType.SAVINGS]: AccountType.SAVINGS,
  [BiAccountType.DEPOSIT]: AccountType.SAVINGS,
  [BiAccountType.LOAN]: AccountType.LOAN,
  [BiAccountType.MARKET]: AccountType.SAVINGS,
  [BiAccountType.JOINT]: AccountType.CHECKINGS,
  [BiAccountType.CARD]: AccountType.CREDIT_CARD,
  [BiAccountType.LIFE_INSURANCE]: AccountType.SAVINGS,
  [BiAccountType.PEE]: AccountType.SAVINGS,
  [BiAccountType.PERCO]: AccountType.SAVINGS,
  [BiAccountType.ARTICLE_83]: AccountType.SAVINGS,
  [BiAccountType.RSP]: AccountType.SAVINGS,
  [BiAccountType.PEA]: AccountType.SAVINGS,
  [BiAccountType.CAPITALISATION]: AccountType.SAVINGS,
  [BiAccountType.PERP]: AccountType.SAVINGS,
  [BiAccountType.MADELIN]: AccountType.SAVINGS,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param accountType BudgetInsight type
 */
// eslint-disable-next-line no-null/no-null
const mapAccountType = (accountType: BiAccountType): AccountType => ACCOUNT_TYPE_MAPPING[accountType] || null;

/**
 * TransactionTypeMapping
 */
interface TransactionTypeMapping {
  [index: string]: TransactionType;
}

const TRANSACTION_TYPE_MAPPING: TransactionTypeMapping = {
  [BiTransactionType.BANK]: TransactionType.BANK_FEE,
  [BiTransactionType.CARD]: TransactionType.POINT_OF_SALE,
  [BiTransactionType.CARD_SUMMARY]: TransactionType.CREDIT_CARD_PAYMENT,
  [BiTransactionType.CHECK]: TransactionType.CHECK,
  [BiTransactionType.DEFERRED_CARD]: TransactionType.POINT_OF_SALE,
  [BiTransactionType.DEPOSIT]: TransactionType.DEPOSIT,
  [BiTransactionType.LOAN_PAYMENT]: TransactionType.REPEATING_PAYMENT,
  [BiTransactionType.ORDER]: TransactionType.OTHER,
  [BiTransactionType.PAYBACK]: TransactionType.OTHER,
  [BiTransactionType.TRANSFER]: TransactionType.ELECTRONIC_PAYMENT,
  [BiTransactionType.WITHDRAWAL]: TransactionType.ATM,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param transactionType BudgetInsight type
 */
const mapTransactionType = (transactionType: BiTransactionType): TransactionType =>
  TRANSACTION_TYPE_MAPPING[transactionType] || TransactionType.OTHER;

/**
 * UsageType TypeMapping
 */
interface UsageTypeMapping {
  [index: string]: UsageType;
}

const USAGE_TYPE_MAPPING: UsageTypeMapping = {
  [BiUsageType.PRIVATE]: UsageType.PERSONAL,
  [BiUsageType.ASSOCIATION]: UsageType.PROFESSIONAL,
  [BiUsageType.PROFESSIONAL]: UsageType.PROFESSIONAL,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param transactionType BudgetInsight type
 */
const mapUsageType = (usageType: BiUsageType): UsageType => USAGE_TYPE_MAPPING[usageType] || UsageType.PERSONAL;
