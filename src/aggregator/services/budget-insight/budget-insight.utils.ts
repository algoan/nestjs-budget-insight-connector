import * as moment from 'moment-timezone';
import {
  PostBanksUserTransactionDTO,
  BanksUserTransactionType as TransactionType,
  UsageType,
  AccountType,
  PostBanksUserAccountDTO,
} from '@algoan/rest';

import {
  BudgetInsightTransaction,
  AccountType as BiAccountType,
  BankAccountUsage as BiUsageType,
  TransactionType as BiTransactionType,
  BudgetInsightAccount,
} from '../../interfaces/budget-insight.interface';

/**
 * mapBudgetInsightAccount transforms a budgetInsight array of connections into
 * an array of Banks User accounts
 * @param connections arrays from Budget Insight
 * @param transactions The complete list of transactions
 */
export const mapBudgetInsightAccount = (accounts: BudgetInsightAccount[]): PostBanksUserAccountDTO[] =>
  accounts.map(fromBIToAlgoanAccounts);

/**
 * Converts a single BI account instance to Algoan format
 * @param account
 */
const fromBIToAlgoanAccounts = (account: BudgetInsightAccount): PostBanksUserAccountDTO => ({
  balanceDate: new Date(mapDate(account.last_update)).toISOString(),
  balance: account.balance,
  bank: account.name,
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
  savingsDetails: account.type === BiAccountType.SAVINGS ? account.company_name : account.original_name,
});

/**
 * mapBudgetInsightTransactions transforms a budgetInsight transaction wrapper into
 * an array of banks user transactions
 * @param transactions TransactionWrapper from Budget Insight
 */
export const mapBudgetInsightTransactions = (transactions: BudgetInsightTransaction[]): PostBanksUserTransactionDTO[] =>
  transactions.map(
    (transaction: BudgetInsightTransaction): PostBanksUserTransactionDTO => ({
      amount: transaction.value,
      simplifiedDescription: transaction.simplified_wording,
      description: transaction.original_wording,
      banksUserCardId: transaction.card,
      reference: transaction.id.toString(),
      userDescription: transaction.wording,
      category: transaction?.category?.name,
      type: mapTransactionType(transaction.type),
      date: moment.tz(transaction.rdate, 'Europe/Paris').toISOString(),
    }),
  );

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
  [BiAccountType.CARD]: AccountType.CREDIT_CARD,
  [BiAccountType.LOAN]: AccountType.LOAN,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param accountType BudgetInsight type
 */
const mapAccountType = (accountType: BiAccountType): AccountType =>
  ACCOUNT_TYPE_MAPPING[accountType] || AccountType.SAVINGS;

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
