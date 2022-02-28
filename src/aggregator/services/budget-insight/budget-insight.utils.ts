import { BanksUserTransactionType as TransactionType } from '@algoan/rest';
import { get, isNil } from 'lodash';
import * as moment from 'moment-timezone';
import { AccountLoanType, AccountOwnership, AccountType, AccountUsage } from '../../../algoan/dto/analysis.enum';
import { Account as AnalysisAccount, AccountTransactions } from '../../../algoan/dto/analysis.inputs';
import {
  AccountType as BiAccountType,
  Bank,
  BankAccountOwnership as BiOwnershipType,
  BankAccountUsage as BiUsageType,
  BudgetInsightAccount,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  TransactionType as BiTransactionType,
} from '../../interfaces/budget-insight.interface';
import { AggregatorService } from '../aggregator.service';
import { ClientConfig } from '../budget-insight/budget-insight.client';
const defaultHour: number = 12;

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
): AnalysisAccount[] =>
  accounts.map((acc: BudgetInsightAccount) => {
    const connection: Connection | undefined = connections?.find((con) => con.id === acc.id_connection);
    const ownerInfo: BudgetInsightOwner | undefined = get(connectionsInfo, `${connection?.id}`);
    const logoUrl: string | undefined = aggregator.getBankLogoUrl(connection, clientConfig);

    return fromBIToAlgoanAccounts(acc, connection?.connector, logoUrl, ownerInfo);
  });

/**
 * Converts a single BI account instance to Algoan format
 * @param account
 */
const fromBIToAlgoanAccounts = (
  account: BudgetInsightAccount,
  bank?: Bank,
  logoUrl?: string,
  ownerInfo?: BudgetInsightOwner,
): AnalysisAccount => ({
  balance: account.balance,
  balanceDate: new Date(mapDate(account.last_update)).toISOString(),
  currency: account.currency?.id,
  type: mapAccountType(account.type),
  usage: mapUsageType(account.usage),
  ownership: mapOwnershipType(account.ownership),
  owners: !isNil(ownerInfo) && !isNil(ownerInfo?.owner?.name) ? [{ name: ownerInfo.owner.name }] : undefined,
  iban: account.iban === null ? undefined : account.iban,
  bic: account.bic,
  name: account.name,
  bank: {
    id: bank?.id?.toString() ?? bank?.uuid,
    name: bank?.name,
    logoUrl,
  },
  coming: account.coming === null ? undefined : account.coming,
  details: {
    savings: mapAccountType(account.type) === AccountType.SAVINGS ? {} : undefined,
    loan:
      account.loan !== null && account.loan !== undefined
        ? {
            amount: account.loan.total_amount,
            startDate: new Date(mapDate(account.loan.subscription_date)).toISOString(),
            endDate: new Date(mapDate(account.loan.maturity_date)).toISOString(),
            duration: account.loan.duration,
            insuranceLabel: account.loan.insurance_label,
            payment: account.loan.next_payment_amount,
            interestRate: account.loan.rate,
            remainingCapital: account.balance,
            type: AccountLoanType.OTHER,
          }
        : undefined,
  },
  aggregator: {
    id: account.id.toString(),
  },
  // eslint-disable-next-line no-null/no-null, id-blacklist
  number: account.number === null ? undefined : account.number,
});

/**
 * mapBudgetInsightTransactions transforms a budgetInsight transaction wrapper into
 * an array of banks user transactions
 * @param transactions TransactionWrapper from Budget Insight
 */
export const mapBudgetInsightTransactions = async (
  transactions: BudgetInsightTransaction[],
  account: AnalysisAccount,
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<AccountTransactions[]> =>
  Promise.all(
    transactions.map(
      async (transaction: BudgetInsightTransaction): Promise<AccountTransactions> => ({
        dates: {
          // The dates are set to 12 UTC because BI does not send real time of the transaction.
          // In a next version of the algoan API, time can be removed from the algoan's transaction
          debitedAt: transaction.date ? moment.tz(transaction.date, 'UTC').hour(defaultHour).toISOString() : undefined,
          bookedAt: transaction.rdate ? moment.tz(transaction.rdate, 'UTC').hour(defaultHour).toISOString() : undefined,
        },
        description: transaction.original_wording,
        amount: transaction.value,
        currency: transaction.original_currency?.id ?? account.currency,
        isComing: transaction.coming,
        aggregator: {
          id: transaction.id.toString(),
          category: await getCategory(aggregator, accessToken, transaction.id_category, clientConfig),
          type: mapTransactionType(transaction.type),
        },
      }),
    ),
  );

const getCategory = async (
  aggregator: AggregatorService,
  accessToken: string,
  categoryId: number | null,
  clientConfig?: ClientConfig,
): Promise<string> => {
  if (categoryId === undefinedCategory) {
    return 'UNKNOWN';
  }
  try {
    return (await aggregator.getCategory(accessToken, categoryId, clientConfig)).name;
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
  [BiAccountType.CHECKING]: AccountType.CHECKING,
  [BiAccountType.SAVINGS]: AccountType.SAVINGS,
  [BiAccountType.DEPOSIT]: AccountType.SAVINGS,
  [BiAccountType.LOAN]: AccountType.LOAN,
  [BiAccountType.MARKET]: AccountType.SAVINGS,
  [BiAccountType.JOINT]: AccountType.CHECKING,
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
const mapAccountType = (accountType: BiAccountType): AccountType =>
  ACCOUNT_TYPE_MAPPING[accountType] ?? AccountType.UNKNOWN;

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
  [index: string]: AccountUsage;
}

const USAGE_TYPE_MAPPING: UsageTypeMapping = {
  [BiUsageType.PRIVATE]: AccountUsage.PERSONAL,
  [BiUsageType.ASSOCIATION]: AccountUsage.PROFESSIONAL,
  [BiUsageType.PROFESSIONAL]: AccountUsage.PROFESSIONAL,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param transactionType BudgetInsight type
 */
const mapUsageType = (usageType: BiUsageType): AccountUsage => USAGE_TYPE_MAPPING[usageType] ?? AccountUsage.UNKNOWN;

/**
 * Undefined category id
 */
const undefinedCategory: number = 9998;

/**
 * OwnershipType TypeMapping
 */
interface OwnershipTypeMapping {
  [index: string]: AccountOwnership;
}

const OWNERSHIP_TYPE_MAPPING: OwnershipTypeMapping = {
  [BiOwnershipType.OWNER]: AccountOwnership.HOLDER,
  [BiOwnershipType.CO_OWNER]: AccountOwnership.CO_HOLDER,
  [BiOwnershipType.ATTORNEY]: AccountOwnership.ATTORNEY,
};

/**
 * mapOwnershipType map the ownership type from the Budget Insights
 * @param ownershipType Budget Insight ownership type
 */
const mapOwnershipType = (ownershipType: BiOwnershipType | null): AccountOwnership | undefined =>
  ownershipType ? OWNERSHIP_TYPE_MAPPING[ownershipType] ?? AccountOwnership.OTHER : undefined;
