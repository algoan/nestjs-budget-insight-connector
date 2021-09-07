import { BanksUserTransactionType as TransactionType } from '@algoan/rest';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountLoanType, AccountType, AccountUsage } from '../../../algoan/dto/analysis.enum';
import { Account as AnalysisAccount, AccountTransactions } from '../../../algoan/dto/analysis.inputs';
import { AggregatorModule } from '../../aggregator.module';
import { mockCategory } from '../../interfaces/budget-insight-mock';
import {
  AccountType as BIAccountType,
  Bank,
  BankAccountUsage as BIUsageType,
  BudgetInsightAccount,
  BudgetInsightCategory,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  TransactionType as BiTransactionType,
} from '../../interfaces/budget-insight.interface';
import { AggregatorService } from '../aggregator.service';
import { mapBudgetInsightAccount, mapBudgetInsightTransactions } from './budget-insight.utils';

describe('BudgetInsightUtils', () => {
  let aggregatorService: AggregatorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AggregatorModule],
    }).compile();
    aggregatorService = module.get<AggregatorService>(AggregatorService);
  });

  it('should map the budget insight connections to analysis', () => {
    const budgetInsightConnections: Connection[] = [
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        connector: {
          id: 2,
          uuid: 'example-uuid',
          name: 'bank-name',
        },
        created: new Date(),
        next_try: new Date(),
      },
    ];
    const ownerInfo: { [key: string]: BudgetInsightOwner } = {
      [budgetInsightConnections[0].id]: {
        owner: {
          company_name: 'Algoan',
          job: 'Developer',
          job_start_date: '2020-09-01',
          name: 'M. JOHN DOE',
        },
      },
    };
    const budgetInsightAccounts: BudgetInsightAccount[] = [
      {
        id: 1,
        id_connection: 32,
        id_user: 33,
        id_source: 34,
        id_parent: 35,
        number: 'mockNumber',
        original_name: 'loan',
        coming: 0,
        last_update: '2011-10-05T14:48:00.000Z',
        balance: -10000,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        type: BIAccountType.LOAN,
        usage: BIUsageType.PRIVATE,
        disabled: false,
        company_name: 'mockCompanyName',
        loan: {
          total_amount: 250,
          id_account: 'loan-account-id',
          maturity_date: '2011-10-05T14:48:00.000Z',
          rate: 1.1,
          next_payment_amount: 5,
          subscription_date: '2011-09-05T14:48:00.000Z',
          duration: 72,
          insurance_label: 'PE',
          type: BIAccountType.LOAN,
        },
      },
      {
        id: 9,
        id_connection: 32,
        id_user: 28,
        id_source: 29,
        id_parent: 210,
        number: 'mockNumber',
        original_name: 'card',
        coming: 120,
        last_update: '2020-10-05T14:48:00.000Z',
        balance: 100,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        type: BIAccountType.CARD,
        usage: BIUsageType.PRIVATE,
        disabled: false,
        company_name: 'mockCompanyName',
      },
    ];
    const expectedAccounts: AnalysisAccount[] = [
      {
        balance: -10000,
        balanceDate: '2011-10-05T14:48:00.000Z',
        bank: {
          id: '2',
          name: 'bank-name',
          logoUrl: 'http://localhost:4000/logos/2-thumbnail@2px.png',
        },
        coming: 0,
        currency: 'USD',
        bic: 'bic',
        iban: 'iban',
        details: {
          loan: {
            amount: 250,
            endDate: '2011-10-05T14:48:00.000Z',
            startDate: '2011-09-05T14:48:00.000Z',
            interestRate: 1.1,
            payment: 5,
            remainingCapital: -10000,
            duration: 72,
            type: AccountLoanType.OTHER,
            insuranceLabel: 'PE',
          },
          savings: undefined,
        },
        name: 'account-name',
        type: AccountType.LOAN,
        usage: AccountUsage.PERSONAL,
        owners: [{ name: 'M. JOHN DOE' }],
        aggregator: {
          id: '1',
        },
      },
      {
        balance: 100,
        balanceDate: '2020-10-05T14:48:00.000Z',
        bank: {
          id: '2',
          name: 'bank-name',
          logoUrl: 'http://localhost:4000/logos/2-thumbnail@2px.png',
        },
        coming: 120,
        currency: 'USD',
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        aggregator: {
          id: '9',
        },
        details: {
          loan: undefined,
          savings: undefined,
        },
        type: AccountType.CREDIT_CARD,
        usage: AccountUsage.PERSONAL,
        owners: [{ name: 'M. JOHN DOE' }],
      },
    ];

    expect(
      mapBudgetInsightAccount(budgetInsightAccounts, aggregatorService, budgetInsightConnections, ownerInfo),
    ).toEqual(expectedAccounts);
  });

  it('should map the budget insight connections to analysis (no owner, no connector)', () => {
    const budgetInsightConnections: Connection[] = [
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        connector: (undefined as unknown) as Bank,
        created: new Date(),
        next_try: new Date(),
      },
    ];
    const ownerInfo: { [key: string]: BudgetInsightOwner } = {};
    const budgetInsightAccounts: BudgetInsightAccount[] = [
      {
        id: 1,
        id_connection: 32,
        id_user: 33,
        id_source: 34,
        id_parent: 35,
        number: 'mockNumber',
        original_name: 'loan',
        coming: null,
        last_update: '2011-10-05T14:48:00.000Z',
        balance: -10000,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: null,
        name: 'account-name',
        type: BIAccountType.UNKNOWN,
        usage: ('UNKNOWN' as unknown) as BIUsageType,
        disabled: false,
        company_name: 'mockCompanyName',
        loan: {
          total_amount: 250,
          id_account: 'loan-account-id',
          maturity_date: '2011-10-05T14:48:00.000Z',
          rate: 1.1,
          next_payment_amount: 5,
          subscription_date: '2011-09-05T14:48:00.000Z',
          duration: 72,
          insurance_label: 'PE',
          type: BIAccountType.LOAN,
        },
      },
      {
        id: 9,
        id_connection: 32,
        id_user: 28,
        id_source: 29,
        id_parent: 210,
        number: 'mockNumber',
        original_name: 'card',
        coming: 120,
        last_update: '2020-10-05T14:48:00.000Z',
        balance: 100,
        currency: { id: 'USD' },
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        type: BIAccountType.CARD,
        usage: BIUsageType.PRIVATE,
        disabled: false,
        company_name: 'mockCompanyName',
      },
    ];
    const expectedAccounts: AnalysisAccount[] = [
      {
        balance: -10000,
        balanceDate: '2011-10-05T14:48:00.000Z',
        bank: {
          id: undefined,
          name: undefined,
        },
        coming: undefined,
        currency: 'USD',
        bic: 'bic',
        iban: undefined,
        details: {
          loan: {
            amount: 250,
            endDate: '2011-10-05T14:48:00.000Z',
            startDate: '2011-09-05T14:48:00.000Z',
            interestRate: 1.1,
            payment: 5,
            remainingCapital: -10000,
            duration: 72,
            type: AccountLoanType.OTHER,
            insuranceLabel: 'PE',
          },
          savings: undefined,
        },
        name: 'account-name',
        type: AccountType.UNKNOWN,
        usage: AccountUsage.UNKNOWN,
        owners: undefined,
        aggregator: {
          id: '1',
        },
      },
      {
        balance: 100,
        balanceDate: '2020-10-05T14:48:00.000Z',
        bank: {
          id: undefined,
          name: undefined,
        },
        coming: 120,
        currency: 'USD',
        bic: 'bic',
        iban: 'iban',
        name: 'account-name',
        aggregator: {
          id: '9',
        },
        details: {
          loan: undefined,
          savings: undefined,
        },
        type: AccountType.CREDIT_CARD,
        usage: AccountUsage.PERSONAL,
        owners: undefined,
      },
    ];

    expect(
      mapBudgetInsightAccount(budgetInsightAccounts, aggregatorService, budgetInsightConnections, ownerInfo),
    ).toEqual(expectedAccounts);
  });

  it('should map the budget insight transactions to analysis', async () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: BiTransactionType.WITHDRAWAL,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: '2010-01-15 15:55:00',
        rdate: '2010-01-15 15:55:00',
        application_date: 'mockApplicationDate',
        original_currency: { id: 'USD' },
        coming: false,
      },
    ];
    const expectedTransaction: AccountTransactions[] = [
      {
        amount: 1,
        aggregator: {
          id: 'id',
          category: 'mockCategoryName',
          type: TransactionType.ATM,
        },
        dates: {
          bookedAt: '2010-01-15T14:55:00.000Z',
          debitedAt: '2010-01-15T14:55:00.000Z',
        },
        description: 'original_wording',
        isComing: false,
        currency: 'USD',
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      ({ currency: 'EUR' } as unknown) as AnalysisAccount,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });

  it('should map the budget insight transactions to analysis (CREDIT_CARD account)', async () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: BiTransactionType.WITHDRAWAL,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: '2010-01-15 15:55:00',
        rdate: '2010-02-15 15:55:00',
        application_date: 'mockApplicationDate',
        original_currency: { id: 'USD' },
        coming: false,
      },
    ];
    const expectedTransaction: AccountTransactions[] = [
      {
        amount: 1,
        aggregator: {
          id: 'id',
          category: 'mockCategoryName',
          type: TransactionType.ATM,
        },
        dates: {
          bookedAt: '2010-02-15T14:55:00.000Z',
          debitedAt: '2010-01-15T14:55:00.000Z',
        },
        description: 'original_wording',
        currency: 'USD',
        isComing: false,
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      ({ currency: 'USD' } as unknown) as AnalysisAccount,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });

  it('should map the budget insight transactions to analysis (currency=null)', async () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: BiTransactionType.WITHDRAWAL,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: '2010-01-15 15:55:00',
        rdate: '2010-02-15 15:55:00',
        application_date: 'mockApplicationDate',
        original_currency: null,
        coming: false,
      },
    ];
    const expectedTransaction: AccountTransactions[] = [
      {
        amount: 1,
        aggregator: {
          id: 'id',
          type: TransactionType.ATM,
          category: 'mockCategoryName',
        },
        dates: {
          bookedAt: '2010-02-15T14:55:00.000Z',
          debitedAt: '2010-01-15T14:55:00.000Z',
        },
        description: 'original_wording',
        isComing: false,
        currency: 'EUR',
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      ({ currency: 'EUR' } as unknown) as AnalysisAccount,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });

  it('should map the budget insight transactions to analysis (getCategory=Error)', async () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: ('UNKNOWN' as unknown) as BiTransactionType,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: (undefined as unknown) as string,
        rdate: (undefined as unknown) as string,
        application_date: 'mockApplicationDate',
        original_currency: null,
        coming: false,
      },
    ];
    const expectedTransaction: AccountTransactions[] = [
      {
        amount: 1,
        aggregator: {
          id: 'id',
          type: TransactionType.OTHER,
          category: 'UNKNOWN',
        },
        dates: {
          bookedAt: undefined,
          debitedAt: undefined,
        },
        description: 'original_wording',
        isComing: false,
        currency: 'EUR',
      },
    ];

    const spy = jest
      .spyOn(aggregatorService, 'getCategory')
      .mockReturnValue(Promise.resolve((undefined as unknown) as BudgetInsightCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      ({ currency: 'EUR' } as unknown) as AnalysisAccount,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });
});
