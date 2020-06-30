import { flatMap } from 'lodash';
import * as moment from 'moment-timezone';
import { PostBanksUserTransactionDTO as Transaction, BanksUserTransactionType as TransactionType } from '@algoan/rest';

import { AccountType, AccountWithTransactions, OwnerType } from '../../../algoan/interfaces/algoan.interface';
import {
  Account as BiAccount,
  AccountType as BiAccountType,
  Connection,
  OwnerType as BiOwnerType,
  Transaction as BiTransaction,
  TransactionType as BiTransactionType,
} from '../../interfaces/budget-insight.interface';

/**
 * mapBudgetInsightAccount transforms a budgetInsight array of connections into
 * an array of Banks User accounts
 * @param connections arrays from Budget Insight
 * @param transactions The complete list of transactions
 */
export const mapBudgetInsightAccount: (
  connections: Connection[],
  transactions: BiTransaction[],
) => AccountWithTransactions[] = (
  connections: Connection[],
  transactions: BiTransaction[],
): AccountWithTransactions[] =>
  flatMap(connections, (connection: Connection): AccountWithTransactions[] =>
    connection.accounts.map(
      (account: BiAccount): AccountWithTransactions => {
        const accountTransactions: Transaction[] = mapBudgetInsightTransactions(
          transactions.filter((transaction: BiTransaction) => transaction.id_account === account.id),
        );

        return {
          transactions: accountTransactions,
          balanceDate: mapDate(account.last_update || connection.last_update),
          balance: account.balance,
          bank: connection?.bank?.name,
          connectionSource: 'BUDGET_INSIGHT',
          type: mapAccountType(account.type),
          bic: account.bic,
          iban: account.iban,
          currency: account.currency.id,
          name: account.name,
          reference: account.id.toString(),
          status: connection.active ? 'ACTIVE' : 'CLOSED',
          usage: mapOwnerType(account.usage),
          loanDetails: account.loan && {
            amount: account.loan.total_amount,
            debitedAccountId: account.loan.id_account,
            startDate: mapDate(account.loan.subscription_date),
            endDate: mapDate(account.loan.maturity_date),
            payment: account.loan.next_payment_amount,
            interestRate: account.loan.rate,
            remainingCapital: account.balance,
            type: mapAccountType(account.loan.type),
          },
          savingsDetails: account.type.toString(),
        };
      },
    ),
  );

/**
 * Transforms a connection containing an array of accounts
 * into an array of Banks User accounts
 * @param connection connection from Budget Insight
 */
export const mapBudgetInsightAccountsFromOneConnection: (connection: Connection) => AccountWithTransactions[] = (
  connection: Connection,
): AccountWithTransactions[] =>
  connection.accounts.map(
    (account: BiAccount): AccountWithTransactions => {
      const accountTransactions: Transaction[] = mapBudgetInsightTransactions(account?.transactions);

      return {
        transactions: accountTransactions,
        balanceDate: mapDate(account.last_update || connection.last_update),
        balance: account.balance,
        bank: connection?.bank?.name,
        connectionSource: 'BUDGET_INSIGHT',
        type: mapAccountType(account.type),
        bic: account.bic,
        iban: account.iban,
        currency: account.currency.id,
        name: account.name,
        reference: account.id.toString(),
        status: connection.active ? 'ACTIVE' : 'CLOSED',
        usage: mapOwnerType(account.usage),
        loanDetails: account.loan && {
          amount: account.loan.total_amount,
          debitedAccountId: account.loan.id_account,
          startDate: mapDate(account.loan.subscription_date),
          endDate: mapDate(account.loan.maturity_date),
          payment: account.loan.next_payment_amount,
          interestRate: account.loan.rate,
          remainingCapital: account.balance,
          type: mapAccountType(account.loan.type),
        },
        savingsDetails: account.type.toString(),
      };
    },
  );

/**
 * mapBudgetInsightTransactions transforms a budgetInsight transaction wrapper into
 * an array of banks user transactions
 * @param transactions TransactionWrapper from Budget Insight
 */
export const mapBudgetInsightTransactions = (transactions: BiTransaction[]): Transaction[] =>
  transactions.map(
    (transaction: BiTransaction): Transaction => ({
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
 * Ownertype TypeMapping
 */
interface OwnerTypeMapping {
  [index: string]: OwnerType;
}

const OWNER_TYPE_MAPPING: OwnerTypeMapping = {
  [BiOwnerType.PRIVATE]: OwnerType.PERSONAL,
  [BiOwnerType.ASSOCIATION]: OwnerType.PROFESSIONAL,
  [BiOwnerType.ORGANIZATION]: OwnerType.PROFESSIONAL,
};

/**
 * mapAccountType map the banksUser type from the budget Insight type
 * @param transactionType BudgetInsight type
 */
const mapOwnerType = (ownerType: BiOwnerType): OwnerType => OWNER_TYPE_MAPPING[ownerType] || OwnerType.PERSONAL;
