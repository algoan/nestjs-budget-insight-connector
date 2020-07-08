import {
  PostBanksUserTransactionDTO,
  BanksUserTransactionType as TransactionType,
  AccountType,
  PostBanksUserAccountDTO,
  UsageType,
} from '@algoan/rest';
import {
  BudgetInsightAccount,
  BudgetInsightTransaction,
  TransactionType as BiTransactionType,
  AccountType as BIAccountType,
  BankAccountUsage as BIUsageType,
} from '../../interfaces/budget-insight.interface';
import { mapBudgetInsightAccount, mapBudgetInsightTransactions } from './budget-insight.utils';

describe('BudgetInsightUtils', () => {
  it('should map the budget insight connections to banksUser', () => {
    const budgetInsightAccounts: BudgetInsightAccount[] = [
      {
        id: 1,
        id_connection: 32,
        id_user: 33,
        id_source: 34,
        id_parent: 35,
        number: 'mockNumber',
        original_name: 'loan',
        coming: 'mockComing',
        last_update: '2011-10-05T14:48:00.000Z',
        balance: -10000,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        type: BIAccountType.LOAN,
        usage: BIUsageType.PRIVATE,
        disabled: true,
        company_name: 'mockCompanyName',
        loan: {
          total_amount: 250,
          id_account: 'loan-account-id',
          maturity_date: '2011-10-05T14:48:00.000Z',
          rate: 1.1,
          next_payment_amount: 5,
          subscription_date: '2011-09-05T14:48:00.000Z',
          type: BIAccountType.LOAN,
        },
      },
      {
        id: 9,
        id_connection: 27,
        id_user: 28,
        id_source: 29,
        id_parent: 210,
        number: 'mockNumber',
        original_name: 'card',
        coming: 'mockComing',
        last_update: '2020-10-05T14:48:00.000Z',
        balance: 100,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        type: BIAccountType.CARD,
        usage: BIUsageType.PRIVATE,
        disabled: true,
        company_name: 'mockCompanyName',
      },
    ];
    const expectedAccounts: PostBanksUserAccountDTO[] = [
      {
        balance: -10000,
        balanceDate: '2011-10-05T14:48:00.000Z',
        bank: 'account-name',
        connectionSource: 'BUDGET_INSIGHT',
        currency: 'USD',
        bic: 'bic',
        iban: 'iban',
        loanDetails: {
          amount: 250,
          debitedAccountId: 'loan-account-id',
          endDate: 1317826080000,
          interestRate: 1.1,
          payment: 5,
          remainingCapital: -10000,
          startDate: 1315234080000,
          type: 'OTHER',
        },
        name: 'account-name',
        reference: '1',
        savingsDetails: 'loan',
        status: 'ACTIVE',
        type: AccountType.LOAN,
        usage: UsageType.PERSONAL,
      },
      {
        balance: 100,
        balanceDate: '2020-10-05T14:48:00.000Z',
        bank: 'account-name',
        connectionSource: 'BUDGET_INSIGHT',
        currency: 'USD',
        bic: 'bic',
        iban: 'iban',
        loanDetails: undefined,
        name: 'account-name',
        reference: '9',
        savingsDetails: 'card',
        status: 'ACTIVE',
        type: AccountType.CREDIT_CARD,
        usage: UsageType.PERSONAL,
      },
    ];

    expect(mapBudgetInsightAccount(budgetInsightAccounts)).toEqual(expectedAccounts);
  });

  it('should map the budget insight transactions to banksUser', () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: BiTransactionType.WITHDRAWAL,
        category: {
          name: 'category',
        },
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        rdate: '2010-01-15 15:55:00',
        application_date: 'mockApplicationDate',
      },
    ];
    const expectedTransaction: PostBanksUserTransactionDTO[] = [
      {
        amount: 1,
        banksUserCardId: 'card',
        category: 'category',
        date: '2010-01-15T14:55:00.000Z',
        description: 'original_wording',
        reference: 'id',
        simplifiedDescription: 'simplifiedWording',
        type: TransactionType.ATM,
        userDescription: 'wording',
      },
    ];

    expect(mapBudgetInsightTransactions(budgetInsightTransactions)).toEqual(expectedTransaction);
  });
});
