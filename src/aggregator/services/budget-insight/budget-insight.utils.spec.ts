import { BanksUserTransactionType as TransactionType } from '@algoan/rest';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountTransactions } from '../../../algoan/dto/analysis.inputs';
import { AggregatorModule } from '../../aggregator.module';
import { mockCategory } from '../../interfaces/budget-insight-mock';
import {
  AccountType as BIAccountType,
  Bank,
  BankAccountOwnership,
  BankAccountUsage as BIUsageType,
  BudgetInsightAccount,
  BudgetInsightCategory,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  TransactionType as BiTransactionType,
} from '../../interfaces/budget-insight.interface';
import {
  EnrichedBudgetInsightTransaction,
  EnrichedConnection,
} from '../../interfaces/enriched-budget-insight.interface';
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
        ownership: BankAccountOwnership.CO_OWNER,
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
        ownership: null,
        disabled: false,
        company_name: 'mockCompanyName',
      },
    ];
    const expectedConnections: EnrichedConnection[] = [
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        connector: { id: 2, uuid: 'example-uuid', name: 'bank-name' },
        created: budgetInsightConnections[0].created,
        next_try: budgetInsightConnections[0].next_try,
        accounts: [
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
            ownership: BankAccountOwnership.CO_OWNER,
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
        ],
        information: {
          owner: { company_name: 'Algoan', job: 'Developer', job_start_date: '2020-09-01', name: 'M. JOHN DOE' },
        },
      },
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        connector: { id: 2, uuid: 'example-uuid', name: 'bank-name' },
        created: budgetInsightConnections[0].created,
        next_try: budgetInsightConnections[0].next_try,
        accounts: [
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
            ownership: null,
            disabled: false,
            company_name: 'mockCompanyName',
          },
        ],
        information: {
          owner: { company_name: 'Algoan', job: 'Developer', job_start_date: '2020-09-01', name: 'M. JOHN DOE' },
        },
      },
    ];

    expect(mapBudgetInsightAccount(budgetInsightAccounts, budgetInsightConnections, ownerInfo)).toEqual(
      expectedConnections,
    );
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
        connector: undefined as unknown as Bank,
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
        usage: 'UNKNOWN' as unknown as BIUsageType,
        ownership: 'foo' as BankAccountOwnership,
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
        ownership: BankAccountOwnership.ATTORNEY,
        disabled: false,
        company_name: 'mockCompanyName',
      },
    ];
    const expectedConnections: EnrichedConnection[] = [
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        created: budgetInsightConnections[0].created,
        next_try: budgetInsightConnections[0].next_try,
        accounts: [
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
            type: 'unknown' as BIAccountType,
            usage: 'UNKNOWN' as BIUsageType,
            ownership: 'foo' as unknown as BankAccountOwnership,
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
        ],
      },
      {
        id: 32,
        id_user: 2,
        id_connector: 3,
        last_update: '',
        state: null,
        active: true,
        created: budgetInsightConnections[0].created,
        next_try: budgetInsightConnections[0].next_try,
        accounts: [
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
            ownership: BankAccountOwnership.ATTORNEY,
            disabled: false,
            company_name: 'mockCompanyName',
          },
        ],
      },
    ];

    expect(mapBudgetInsightAccount(budgetInsightAccounts, budgetInsightConnections, ownerInfo)).toEqual(
      expectedConnections,
    );
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
    const expectedTransaction: EnrichedBudgetInsightTransaction[] = [
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
        category: { name: 'mockCategoryName' },
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
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
    const expectedTransaction: EnrichedBudgetInsightTransaction[] = [
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
        category: { name: 'mockCategoryName' },
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
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
    const expectedTransaction: EnrichedBudgetInsightTransaction[] = [
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
        category: { name: 'mockCategoryName' },
      },
    ];

    const spy = jest.spyOn(aggregatorService, 'getCategory').mockReturnValue(Promise.resolve(mockCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });

  it('should map the budget insight transactions to analysis (getCategory=Error)', async () => {
    const budgetInsightTransactions: BudgetInsightTransaction[] = [
      {
        type: 'UNKNOWN' as unknown as BiTransactionType,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: undefined as unknown as string,
        rdate: undefined as unknown as string,
        application_date: 'mockApplicationDate',
        original_currency: null,
        coming: false,
      },
    ];
    const expectedTransaction: EnrichedBudgetInsightTransaction[] = [
      {
        type: 'UNKNOWN' as unknown as BiTransactionType,
        id_category: 20,
        original_wording: 'original_wording',
        wording: 'wording',
        card: 'card',
        simplified_wording: 'simplifiedWording',
        value: 1,
        id_account: 9,
        id: 'id',
        date: undefined as unknown as string,
        rdate: undefined as unknown as string,
        application_date: 'mockApplicationDate',
        original_currency: null,
        coming: false,
        category: {},
      },
    ];

    const spy = jest
      .spyOn(aggregatorService, 'getCategory')
      .mockReturnValue(Promise.resolve(undefined as unknown as BudgetInsightCategory));
    const mappedTransaction = await mapBudgetInsightTransactions(
      budgetInsightTransactions,
      'mockAccessToken',
      aggregatorService,
    );

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(spy).toBeCalledWith('mockAccessToken', budgetInsightTransactions[0].id_category, undefined);
  });
});
