import {
  AccountOwnership,
  AccountPartyRole,
  AccountType,
  BankAccountOwnership,
  BankAccountUsage,
  BudgetInsightAccount,
  BudgetInsightCategory,
  BudgetInsightTransaction,
  TransactionType,
} from './budget-insight.interface';

export const mockAccount: BudgetInsightAccount = {
  id: 1,
  id_connection: 2,
  id_user: 3,
  id_source: 4,
  id_parent: 5,
  // eslint-disable-next-line id-blacklist
  number: 'mockNumber',
  original_name: 'mockOrginalName',
  coming: 0,
  currency: { id: 'id1' },
  balance: 100,
  name: 'mockName',
  last_update: '2011-10-05T14:48:00.000Z',
  type: AccountType.CHECKING,
  iban: 'mockIban',
  bic: 'mockBic',
  disabled: false,
  company_name: 'mockCompany',
  usage: BankAccountUsage.PRIVATE,
  ownership: BankAccountOwnership.OWNER,
};

export const mockTransaction: BudgetInsightTransaction = {
  id_account: 5,
  id: 'mockId',
  application_date: 'mockApplicationDate',
  date: 'mockDate',
  rdate: 'mockRDate',
  simplified_wording: 'mockSimplifiedWording',
  value: 50,
  card: 'mockCard',
  wording: 'mockWording',
  id_category: 10,
  type: TransactionType.BANK,
  original_wording: 'mockOriginalWording',
  original_currency: { id: 'USD' },
  coming: false,
};

export const mockCategory: BudgetInsightCategory = {
  id: 10,
  id_parent_category: 15,
  name: 'mockCategoryName',
  color: 'mockColor',
  income: true,
  refundable: false,
  id_logo: 20,
};

export const mockAccountOwnerships: AccountOwnership[] = [
  {
    id_account: 351,
    id_connection: 1,
    id_user: 0,
    id_connector_source: 0,
    name: 'Saving account 01',
    usage: BankAccountUsage.PRIVATE,
    identifications: null,
    parties: [
      {
        role: AccountPartyRole.HOLDER,
        identity: {
          is_user: true,
          full_name: 'Jean Pierre',
        },
      },
    ],
  },
];
